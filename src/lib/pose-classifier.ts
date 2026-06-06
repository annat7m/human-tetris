// Shape detection: map a body pose to one of the 7 ShapeIds.
// Design: docs/mediapipe-shape-recognition.md
//
// Pure geometry, no ML. Each arm (shoulder->elbow->wrist) is reduced to a
// discrete ArmState, then the (left, right) pair is looked up in SHAPE_TABLE.

import type { ShapeId } from "#/lib/recognition-types";
import { angleDeg, type Pt } from "#/lib/geometry";

export type ArmState = "UP" | "OUT" | "DOWN" | "BENT";

// Tuning knobs — adjust live against the webcam.
const BENT_ELBOW_DEG = 100; // elbow angle below this counts as "bent in"
const VERTICAL_MARGIN = 0.1; // how far wrist must clear the shoulder (normalized y)
const MIN_VISIBILITY = 0.5; // landmarks below this are treated as not visible

/**
 * Reduce one arm to a discrete state.
 * Order matters: a bent elbow wins over up/down/out (that's how SQUARE reads).
 * Remember: y grows downward, so "above" means a smaller y.
 */
export function armState(shoulder: Pt, elbow: Pt, wrist: Pt): ArmState {
  if (angleDeg(shoulder, elbow, wrist) < BENT_ELBOW_DEG) return "BENT";
  if (wrist.y < shoulder.y - VERTICAL_MARGIN) return "UP";
  if (wrist.y > shoulder.y + VERTICAL_MARGIN) return "DOWN";
  return "OUT";
}

// Key = `${leftArmState}|${rightArmState}`, where left/right are the subject's
// own (anatomical) sides — MediaPipe landmark indices 11/13/15 vs 12/14/16.
// Mapping per docs/mediapipe-shape-recognition.md.
const SHAPE_TABLE: Record<string, ShapeId> = {
  "OUT|OUT": "LINE_H",
  "UP|UP": "LINE_V",
  "BENT|BENT": "SQUARE",
  "UP|OUT": "L_0",
  "OUT|UP": "L_90",
  "OUT|DOWN": "L_180",
  "DOWN|OUT": "L_270",
};

export function classifyShape(left: ArmState, right: ArmState): ShapeId | null {
  return SHAPE_TABLE[`${left}|${right}`] ?? null;
}

// A landmark as returned by MediaPipe's PoseLandmarker.
export interface PoseLandmark extends Pt {
  z?: number;
  visibility?: number;
}

// MediaPipe Pose landmark indices for the arms.
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;

const ARM_INDICES = [
  L_SHOULDER,
  R_SHOULDER,
  L_ELBOW,
  R_ELBOW,
  L_WRIST,
  R_WRIST,
];

/**
 * Classify a full landmark array straight from PoseLandmarker.
 * Returns null when the arm landmarks aren't confidently visible or the pose
 * doesn't match any known shape.
 */
export function classifyShapeFromLandmarks(
  landmarks: PoseLandmark[] | undefined,
): ShapeId | null {
  if (!landmarks || landmarks.length <= R_WRIST) return null;

  for (const i of ARM_INDICES) {
    const lm = landmarks[i];
    if (!lm) return null;
    // Treat a missing visibility as "not visible" — better to skip than to
    // classify on a landmark MediaPipe only guessed at (e.g. arm out of frame).
    if (lm.visibility != null && lm.visibility < MIN_VISIBILITY) return null;
  }

  const left = armState(
    landmarks[L_SHOULDER],
    landmarks[L_ELBOW],
    landmarks[L_WRIST],
  );
  const right = armState(
    landmarks[R_SHOULDER],
    landmarks[R_ELBOW],
    landmarks[R_WRIST],
  );
  return classifyShape(left, right);
}

/** Exposed for the debug HUD / tuning. */
export function armStatesFromLandmarks(
  landmarks: PoseLandmark[] | undefined,
): { left: ArmState; right: ArmState } | null {
  if (!landmarks || landmarks.length <= R_WRIST) return null;
  return {
    left: armState(
      landmarks[L_SHOULDER],
      landmarks[L_ELBOW],
      landmarks[L_WRIST],
    ),
    right: armState(
      landmarks[R_SHOULDER],
      landmarks[R_ELBOW],
      landmarks[R_WRIST],
    ),
  };
}
