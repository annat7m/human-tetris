import { useEffect, useRef, useState } from 'react'
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'
import type { RecognitionProps } from '#/lib/recognition-types'

// CDN sources for the MediaPipe WASM runtime + pose model.
// Swap to self-hosted assets later if we want offline / deterministic builds.
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

type Status = 'idle' | 'loading' | 'running' | 'error'

/**
 * Recognition — the Engine/Recognition boundary component.
 *
 * For now this is a wiring harness only: it owns the camera + MediaPipe pose
 * pipeline and renders a mirrored preview with the skeleton overlay. No shape
 * or pointing algorithms yet, so `onShapeDetected` / `onPoint` never fire.
 */
export default function Recognition({ mode }: RecognitionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setStatus('loading')
      setError(null)
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        setStatus('running')
        loop()
      } catch (err) {
        if (cancelled) return
        console.error('[Recognition] failed to start', err)
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    }

    function loop() {
      const video = videoRef.current
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current
      if (!video || !canvas || !landmarker) return

      if (video.readyState >= 2) {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          const result = landmarker.detectForVideo(video, performance.now())
          ctx.save()
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          // Mirror so "raise your right hand" maps to the right side of frame.
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
          const drawing = new DrawingUtils(ctx)
          for (const landmarks of result.landmarks) {
            drawing.drawConnectors(
              landmarks,
              PoseLandmarker.POSE_CONNECTIONS,
              { color: '#4fb8b2', lineWidth: 4 },
            )
            drawing.drawLandmarks(landmarks, {
              color: '#ffffff',
              fillColor: '#2f6a4a',
              lineWidth: 2,
              radius: 4,
            })
          }
          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
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
            status === 'running'
              ? 'bg-emerald-400'
              : status === 'error'
                ? 'bg-rose-400'
                : 'bg-amber-300'
          }`}
        />
        <span>mode: {mode}</span>
        <span className="opacity-60">·</span>
        <span className="opacity-80">{status}</span>
      </div>

      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
          Loading MediaPipe model…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-rose-200">
          Camera / model error: {error}
        </div>
      )}
    </div>
  )
}
