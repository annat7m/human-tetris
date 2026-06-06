import { useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import type { Mode, RecognitionProps, ShapeId } from "#/lib/recognition-types";
import { PointingDetector } from "#/lib/pointing-recognition";
import type { PointingDebug } from "#/lib/pointing-recognition";
import {
  armStatesFromLandmarks,
  classifyShapeFromLandmarks,
  type ArmState,
} from "#/lib/pose-classifier";

// The Engine/Recognition contract is just RecognitionProps. `onDebug` is an
// extra, optional tap for the test harness only — it is NOT part of the
// boundary and the real game ignores it.
type RecognitionComponentProps = RecognitionProps & {
  onDebug?: (debug: PointingDebug) => void;
  /** Override the preview container styling (e.g. to fill a fixed-height slot). */
  className?: string;
  /** Bump this to re-arm the detector mid-phase (test harness only). */
  resetSignal?: number;
};

const DEFAULT_CONTAINER_CLASS =
  "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black";

const DEBUG_INTERVAL_MS = 80; // ~12 debug updates/sec, independent of frame rate

// CDN sources for the MediaPipe WASM runtime + pose model.
// Swap to self-hosted assets later if we want offline / deterministic builds.
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Status = "idle" | "loading" | "running" | "error";

// How long a single candidate shape must be held steady before we emit.
// Time-based (not frame-count) so behavior is consistent across frame rates.
const HOLD_MS = 450;

interface DebugInfo {
  left: ArmState | null;
  right: ArmState | null;
  candidate: ShapeId | null;
  detected: ShapeId | null;
}

/**
 * Recognition — the Engine/Recognition boundary component.
 *
 * Owns the camera + MediaPipe pose pipeline and renders a mirrored preview with
 * the skeleton overlay. Exactly one detection algorithm runs per frame,
 * selected by `mode`: during 'making' it classifies the body pose and fires
 * `onShapeDetected` once per phase; during 'pointing' it runs the corner
 * pointing detector and fires `onPoint`.
 */
export default function Recognition({
  mode,
  onShapeDetected,
  onPoint,
  onDebug,
  className = DEFAULT_CONTAINER_CLASS,
  resetSignal,
}: RecognitionComponentProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live refs so the rAF loop (set up once) always sees current values.
  const modeRef = useRef<Mode>(mode);
  const onShapeDetectedRef = useRef(onShapeDetected);

  // Pointing algorithm + per-frame plumbing. Kept in refs so the render loop
  // always sees the latest mode/callback without restarting.
  const detectorRef = useRef<PointingDetector>(new PointingDetector());
  const onPointRef = useRef(onPoint);
  const onDebugRef = useRef(onDebug);
  const lastTsRef = useRef<number | null>(null);
  const lastDebugTsRef = useRef<number>(0);

  // Shape-detection state for the 'making' phase.
  const candidateRef = useRef<ShapeId | null>(null); // current stable-candidate
  const candidateSinceRef = useRef(0); // timestamp the candidate first appeared
  const emittedRef = useRef(false);
  const lastDetectedRef = useRef<ShapeId | null>(null);
  const debugKeyRef = useRef("");

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugInfo>({
    left: null,
    right: null,
    candidate: null,
    detected: null,
  });

  // Keep callback refs in sync without re-running the camera setup effect.
  useEffect(() => {
    onShapeDetectedRef.current = onShapeDetected;
  }, [onShapeDetected]);

  useEffect(() => {
    onPointRef.current = onPoint;
  }, [onPoint]);

  useEffect(() => {
    onDebugRef.current = onDebug;
  }, [onDebug]);

  // Each new phase emits at most once — reset all detection state on mode change.
  useEffect(() => {
    modeRef.current = mode;
    // Pointing detector.
    detectorRef.current.reset();
    lastTsRef.current = null;
    // Shape detector.
    candidateRef.current = null;
    candidateSinceRef.current = 0;
    emittedRef.current = false;
    lastDetectedRef.current = null;
    debugKeyRef.current = "";
    setDebug({ left: null, right: null, candidate: null, detected: null });
  }, [mode]);

  // An explicit reset signal re-arms the pointing detector mid-phase (test harness).
  useEffect(() => {
    if (resetSignal === undefined) return;
    detectorRef.current.reset();
    lastTsRef.current = null;
  }, [resetSignal]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setStatus("loading");
      setError(null);
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        // play() awaits — bail (and tear down) if we were unmounted meanwhile.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setStatus("running");
        loop();
      } catch (err) {
        if (cancelled) return;
        console.error("[Recognition] failed to start", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker) return;

      if (video.readyState >= 2) {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);

        // Pointing phase: feed the active pose to the algorithm. One simple
        // call — all the logic lives in PointingDetector.
        if (modeRef.current === "pointing" && result.landmarks.length > 0) {
          const last = lastTsRef.current;
          lastTsRef.current = now;
          if (last != null) {
            const corner = detectorRef.current.update(
              result.landmarks[0],
              (now - last) / 1000,
            );
            if (corner) onPointRef.current?.(corner);
          }

          // Surface internals to the harness at a throttled rate.
          if (
            onDebugRef.current &&
            now - lastDebugTsRef.current >= DEBUG_INTERVAL_MS
          ) {
            lastDebugTsRef.current = now;
            onDebugRef.current(detectorRef.current.getDebug());
          }
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Mirror so "raise your right hand" maps to the right side of frame.
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          const drawing = new DrawingUtils(ctx);
          for (const landmarks of result.landmarks) {
            drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
              color: "#4fb8b2",
              lineWidth: 4,
            });
            drawing.drawLandmarks(landmarks, {
              color: "#ffffff",
              fillColor: "#2f6a4a",
              lineWidth: 2,
              radius: 4,
            });
          }
          ctx.restore();
        }

        // Shape detection runs only during the 'making' phase.
        if (modeRef.current === "making") {
          const landmarks = result.landmarks[0];
          const states = armStatesFromLandmarks(landmarks);
          const candidate = classifyShapeFromLandmarks(landmarks);

          // Restart the hold timer whenever the candidate changes (incl. -> null).
          if (candidate !== candidateRef.current) {
            candidateRef.current = candidate;
            candidateSinceRef.current = now;
          }

          // Emit once the same non-null shape has been held steadily for HOLD_MS.
          if (
            candidate !== null &&
            !emittedRef.current &&
            now - candidateSinceRef.current >= HOLD_MS
          ) {
            emittedRef.current = true;
            lastDetectedRef.current = candidate;
            onShapeDetectedRef.current?.(candidate);
          }

          // Throttle HUD updates: only re-render when something changed.
          const key = `${states?.left ?? "-"}|${states?.right ?? "-"}|${candidate ?? "-"}|${lastDetectedRef.current ?? "-"}`;
          if (key !== debugKeyRef.current) {
            debugKeyRef.current = key;
            setDebug({
              left: states?.left ?? null,
              right: states?.right ?? null,
              candidate,
              detected: lastDetectedRef.current,
            });
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (videoRef.current) videoRef.current.srcObject = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  return (
    <div className={className}>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "running"
              ? "bg-emerald-400"
              : status === "error"
                ? "bg-rose-400"
                : "bg-amber-300"
          }`}
        />
        <span>mode: {mode}</span>
        <span className="opacity-60">·</span>
        <span className="opacity-80">{status}</span>
      </div>

      {status === "running" && mode === "making" && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-xl bg-black/55 px-3 py-2 font-mono text-xs text-white backdrop-blur">
          <span>
            L:<b className="text-emerald-300">{debug.left ?? "–"}</b> R:
            <b className="text-emerald-300">{debug.right ?? "–"}</b>
          </span>
          <span className="opacity-80">
            candidate: <b>{debug.candidate ?? "–"}</b>
          </span>
          <span>
            detected: <b className="text-amber-300">{debug.detected ?? "…"}</b>
          </span>
        </div>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
          Loading MediaPipe model…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-rose-200">
          Camera / model error: {error}
        </div>
      )}
    </div>
  );
}
