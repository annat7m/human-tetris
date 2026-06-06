// Shape detection: map a body pose to one of the 7 ShapeIds.
// Design: docs/mediapipe-shape-recognition.md
//
// Pure geometry, no ML. Each arm (shoulder->elbow->wrist) is reduced to a
// discrete ArmState, then the (left, right) pair is looked up in SHAPE_TABLE.

import { SHAPES, type ShapeId } from '#/lib/recognition-types'
import { angleDeg, type Pt } from '#/lib/geometry'

export type ArmState = 'UP' | 'OUT' | 'DOWN' | 'BENT'

// Tuning knobs — adjust live against the webcam.
const BENT_ELBOW_DEG = 100 // elbow angle below this counts as "bent in"
const VERTICAL_MARGIN = 0.1 // how far wrist must clear the shoulder (normalized y)
const MIN_VISIBILITY = 0.5 // landmarks below this are treated as not visible

/**
 * Reduce one arm to a discrete state.
 * Order matters: a bent elbow wins over up/down/out (that's how SQUARE reads).
 * Remember: y grows downward, so "above" means a smaller y.
 */
export function armState(shoulder: Pt, elbow: Pt, wrist: Pt): ArmState {
  if (angleDeg(shoulder, elbow, wrist) < BENT_ELBOW_DEG) return 'BENT'
  if (wrist.y < shoulder.y - VERTICAL_MARGIN) return 'UP'
  if (wrist.y > shoulder.y + VERTICAL_MARGIN) return 'DOWN'
  return 'OUT'
}

// Key = `${leftArmState}|${rightArmState}`, where left/right are the subject's
// own (anatomical) sides — MediaPipe landmark indices 11/13/15 vs 12/14/16.
// Mapping per docs/mediapipe-shape-recognition.md.
const SHAPE_TABLE: Record<string, ShapeId> = {
  'OUT|OUT': 'LINE_H',
  'UP|UP': 'LINE_V',
  'BENT|BENT': 'SQUARE',
  'UP|OUT': 'L_0',
  'OUT|UP': 'L_90',
  'OUT|DOWN': 'L_180',
  'DOWN|OUT': 'L_270',
}

export function classifyShape(left: ArmState, right: ArmState): ShapeId | null {
  return SHAPE_TABLE[`${left}|${right}`] ?? null
}

// A landmark as returned by MediaPipe's PoseLandmarker.
export interface PoseLandmark extends Pt {
  z?: number
  visibility?: number
}

// MediaPipe Pose landmark indices for the arms.
const L_SHOULDER = 11
const R_SHOULDER = 12
const L_ELBOW = 13
const R_ELBOW = 14
const L_WRIST = 15
const R_WRIST = 16

const ARM_INDICES = [L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST]

/**
 * Classify a full landmark array straight from PoseLandmarker.
 * Returns null when the arm landmarks aren't confidently visible or the pose
 * doesn't match any known shape.
 */
export function classifyShapeFromLandmarks(
  landmarks: PoseLandmark[] | undefined,
): ShapeId | null {
  if (!landmarks || landmarks.length <= R_WRIST) return null

  for (const i of ARM_INDICES) {
    const lm = landmarks[i]
    if (!lm) return null
    // Treat a missing visibility as "not visible" — better to skip than to
    // classify on a landmark MediaPipe only guessed at (e.g. arm out of frame).
    if (lm.visibility != null && lm.visibility < MIN_VISIBILITY) return null
  }

  const left = armState(
    landmarks[L_SHOULDER],
    landmarks[L_ELBOW],
    landmarks[L_WRIST],
  )
  const right = armState(
    landmarks[R_SHOULDER],
    landmarks[R_ELBOW],
    landmarks[R_WRIST],
  )
  return classifyShape(left, right)
}

/** Exposed for the debug HUD / tuning. */
export function armStatesFromLandmarks(
  landmarks: PoseLandmark[] | undefined,
): { left: ArmState; right: ArmState } | null {
  if (!landmarks || landmarks.length <= R_WRIST) return null
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
  }
}

// ── Shape detector ──────────────────────────────────────────────────────────
// A small state machine (mirrors PointingDetector) that turns a stream of
// frames into a single ShapeId, fired once a held pose "charges" to full.
// Feed it one frame + the elapsed dt; it charges the current candidate shape
// and drains the rest, so a steadily-held pose wins and brief flickers don't.

export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[]

const SHAPE_HOLD_SECONDS = 0.5 // how long a pose must be held to fire
const SHAPE_DRAIN_RATIO = 2 // non-candidate shapes drain 2x faster than charge
const MAX_DT = 0.1 // clamp dt so a stalled frame can't dump a huge step

/** Live snapshot of the detector's internals — for debug overlays only. */
export interface ShapeDebug {
  /** Arm states this frame. */
  left: ArmState | null
  right: ArmState | null
  /** Shape being charged this frame, if any. */
  candidate: ShapeId | null
  /** Charge per shape in [0,1]; a shape fires at 1. */
  charge: Record<ShapeId, number>
  /** Seconds a pose must be held to fire. */
  holdSeconds: number
}

export class ShapeDetector {
  private readonly holdSeconds: number
  private readonly charge: Record<ShapeId, number>
  private fired = false
  private dbgLeft: ArmState | null = null
  private dbgRight: ArmState | null = null
  private dbgCandidate: ShapeId | null = null

  constructor(holdSeconds: number = SHAPE_HOLD_SECONDS) {
    this.holdSeconds = holdSeconds
    this.charge = emptyCharge()
  }

  /** Clear all state. Call on every phase change so we fire once per phase. */
  reset(): void {
    for (const s of SHAPE_IDS) this.charge[s] = 0
    this.fired = false
    this.dbgLeft = null
    this.dbgRight = null
    this.dbgCandidate = null
  }

  /** Read-only snapshot of what the detector currently "sees". Overlays only. */
  getDebug(): ShapeDebug {
    return {
      left: this.dbgLeft,
      right: this.dbgRight,
      candidate: this.dbgCandidate,
      charge: { ...this.charge },
      holdSeconds: this.holdSeconds,
    }
  }

  /**
   * Feed one frame of pose landmarks plus the elapsed time since the previous
   * frame (seconds). Returns a ShapeId exactly once when a pose is held long
   * enough, otherwise null.
   */
  update(landmarks: PoseLandmark[] | undefined, dt: number): ShapeId | null {
    if (this.fired || dt <= 0) return null
    const step = Math.min(dt, MAX_DT)

    const states = armStatesFromLandmarks(landmarks)
    this.dbgLeft = states?.left ?? null
    this.dbgRight = states?.right ?? null
    const candidate = classifyShapeFromLandmarks(landmarks)
    this.dbgCandidate = candidate

    // Charge the candidate; drain every other shape faster.
    for (const s of SHAPE_IDS) {
      const delta =
        s === candidate
          ? step / this.holdSeconds
          : -(step / this.holdSeconds) * SHAPE_DRAIN_RATIO
      this.charge[s] = clamp01(this.charge[s] + delta)
    }

    if (candidate && this.charge[candidate] >= 1) {
      this.fired = true
      return candidate
    }
    return null
  }
}

function emptyCharge(): Record<ShapeId, number> {
  const c = {} as Record<ShapeId, number>
  for (const s of SHAPE_IDS) c[s] = 0
  return c
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
