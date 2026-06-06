// Pointing recognition algorithm.
// Source of truth: fedya-prompts/pointing-recognition.md
//
// Self-contained, framework-agnostic state machine. Feed it MediaPipe pose
// landmarks one frame at a time; it emits a Corner exactly once when a point
// is held long enough, then stays silent until `reset()` (a new phase).
//
// The whole sensitivity dial is ONE number: `holdSeconds` (T). Everything else
// (REACH, EMA window, drain ratio) is derived or fixed per the whiteboard.

import type { Corner } from '#/lib/recognition-types'

/** Minimal landmark shape — structurally compatible with MediaPipe's NormalizedLandmark. */
export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

// MediaPipe Pose landmark indices we care about.
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_WRIST = 15
const RIGHT_WRIST = 16

// Fixed/derived constants (never user-facing knobs).
const DEFAULT_HOLD_SECONDS = 0.8 // T
const REACH = 1.1 // active if wrist is past 1.1x shoulder width from shoulder
const DRAIN_RATIO = 2 // non-candidate corners drain 2x faster than they charge
const EMA_WINDOW_RATIO = 1 / 3 // EMA time constant ≈ T/3
const MIN_VISIBILITY = 0.5
const MAX_DT = 0.1 // clamp dt so a stalled frame can't dump a huge charge step

const CORNERS: Corner[] = ['TL', 'TR', 'BL', 'BR']

/** Active wrist offset from the shoulder center, in shoulder-width units, screen space. */
interface Frame {
  dx: number
  dy: number
}

/** Live snapshot of the detector's internals — for debug overlays only. */
export interface PointingDebug {
  /** Are both shoulders reliably visible this frame? */
  bodyVisible: boolean
  /** Per-arm extension (|wrist − shoulder| / shoulder width); null if not visible. */
  extension: { left: number | null; right: number | null }
  /** The arm currently driving the candidate, if any. */
  activeArm: 'left' | 'right' | null
  /** Corner being charged this frame (post-EMA quadrant), if any. */
  candidate: Corner | null
  /** Charge per corner in [0,1]; a corner fires at 1. */
  charge: Record<Corner, number>
  /** The reach gate an arm must clear to count as pointing. */
  reach: number
  /** The single sensitivity knob, T (seconds to hold). */
  holdSeconds: number
}

export class PointingDetector {
  private readonly holdSeconds: number
  private readonly emaTau: number
  private readonly charge: Record<Corner, number> = {
    TL: 0,
    TR: 0,
    BL: 0,
    BR: 0,
  }
  private emaDx: number | null = null
  private emaDy: number | null = null
  private fired = false

  // Debug-only mirrors of the latest frame; never affect the algorithm.
  private dbgBodyVisible = false
  private dbgLeftExt: number | null = null
  private dbgRightExt: number | null = null
  private dbgActiveArm: 'left' | 'right' | null = null
  private dbgCandidate: Corner | null = null

  constructor(holdSeconds: number = DEFAULT_HOLD_SECONDS) {
    this.holdSeconds = holdSeconds
    this.emaTau = holdSeconds * EMA_WINDOW_RATIO
  }

  /** Clear all state. Call this on every phase change so we fire once per phase. */
  reset(): void {
    for (const c of CORNERS) this.charge[c] = 0
    this.emaDx = null
    this.emaDy = null
    this.fired = false
    this.dbgBodyVisible = false
    this.dbgLeftExt = null
    this.dbgRightExt = null
    this.dbgActiveArm = null
    this.dbgCandidate = null
  }

  /** Read-only snapshot of what the detector currently "sees". Debug overlays only. */
  getDebug(): PointingDebug {
    return {
      bodyVisible: this.dbgBodyVisible,
      extension: { left: this.dbgLeftExt, right: this.dbgRightExt },
      activeArm: this.dbgActiveArm,
      candidate: this.dbgCandidate,
      charge: { ...this.charge },
      reach: REACH,
      holdSeconds: this.holdSeconds,
    }
  }

  /**
   * Feed one frame of pose landmarks plus the elapsed time since the previous
   * frame (seconds). Returns a Corner exactly once when a point is confirmed,
   * otherwise null.
   */
  update(landmarks: Landmark[], dt: number): Corner | null {
    if (this.fired || dt <= 0) return null
    const step = Math.min(dt, MAX_DT)

    const frame = this.readFrame(landmarks, step)
    const candidate = frame ? quadrant(frame.dx, frame.dy) : null
    this.dbgCandidate = candidate

    // Charge the candidate corner; drain every other corner twice as fast.
    for (const c of CORNERS) {
      const delta =
        c === candidate
          ? step / this.holdSeconds
          : -(step / this.holdSeconds) * DRAIN_RATIO
      this.charge[c] = clamp01(this.charge[c] + delta)
    }

    if (candidate && this.charge[candidate] >= 1) {
      this.fired = true
      return candidate
    }
    return null
  }

  /**
   * Resolve the active arm and return the EMA-smoothed wrist offset from the
   * shoulder center (screen space, shoulder-width units). Returns null when no
   * arm is reaching past REACH or the body isn't reliably visible.
   */
  private readFrame(landmarks: Landmark[], dt: number): Frame | null {
    const lSh = landmarks[LEFT_SHOULDER]
    const rSh = landmarks[RIGHT_SHOULDER]
    const lWr = landmarks[LEFT_WRIST]
    const rWr = landmarks[RIGHT_WRIST]
    if (!lSh || !rSh || !visible(lSh) || !visible(rSh)) {
      this.dbgBodyVisible = false
      this.dbgLeftExt = null
      this.dbgRightExt = null
      this.dbgActiveArm = null
      this.forgetTrackers()
      return null
    }
    this.dbgBodyVisible = true

    // Mirror x into screen space so "raise right hand up-right" reads as TR.
    const lShX = 1 - lSh.x
    const rShX = 1 - rSh.x
    const centerX = (lShX + rShX) / 2
    const centerY = (lSh.y + rSh.y) / 2
    const scale = Math.hypot(lShX - rShX, lSh.y - rSh.y)
    if (scale <= 1e-6) {
      this.forgetTrackers()
      return null
    }

    // Per-arm extension = |wrist - shoulder| / scale gates out a resting/bent
    // arm tucked near the torso (REACH gate).
    const leftExt = armExtension(lSh, lWr, scale)
    const rightExt = armExtension(rSh, rWr, scale)
    this.dbgLeftExt = leftExt
    this.dbgRightExt = rightExt

    // Among arms that clear REACH, the active one is the MORE EXTREME point:
    // the wrist furthest from the body center. Extension-from-shoulder only
    // measures how straight an arm is, so a relaxed arm hanging straight down
    // scores high there yet stays near the midline — distance-from-center
    // correctly prefers the arm that's actually reaching out to a corner.
    let activeWrist: Landmark | null = null
    let activeArm: 'left' | 'right' | null = null
    let bestDist = -1
    for (const [ext, wrist, arm] of [
      [leftExt, lWr, 'left'] as const,
      [rightExt, rWr, 'right'] as const,
    ]) {
      if (ext === null || ext <= REACH || !wrist) continue
      const dist = Math.hypot(1 - wrist.x - centerX, wrist.y - centerY)
      if (dist > bestDist) {
        bestDist = dist
        activeWrist = wrist
        activeArm = arm
      }
    }
    this.dbgActiveArm = activeArm

    if (!activeWrist) {
      // Nobody reaching: let the EMA decay so a re-reach starts fresh.
      this.forgetTrackers()
      return null
    }

    const rawDx = 1 - activeWrist.x - centerX
    const rawDy = activeWrist.y - centerY

    const alpha = emaAlpha(dt, this.emaTau)
    this.emaDx =
      this.emaDx === null ? rawDx : this.emaDx + alpha * (rawDx - this.emaDx)
    this.emaDy =
      this.emaDy === null ? rawDy : this.emaDy + alpha * (rawDy - this.emaDy)

    return { dx: this.emaDx, dy: this.emaDy }
  }

  /** Let the smoothing trackers forget when there's no active wrist. */
  private forgetTrackers(): void {
    this.emaDx = null
    this.emaDy = null
  }
}

/** Wrist reach from its shoulder in shoulder-width units, or null if not visible. */
function armExtension(
  shoulder: Landmark,
  wrist: Landmark | undefined,
  scale: number,
): number | null {
  if (!wrist || !visible(shoulder) || !visible(wrist)) return null
  return Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y) / scale
}

/** Screen-space quadrant from the sign of the wrist offset (y grows downward). */
function quadrant(dx: number, dy: number): Corner {
  const right = dx > 0
  const down = dy > 0
  if (down) return right ? 'BR' : 'BL'
  return right ? 'TR' : 'TL'
}

function visible(lm: Landmark): boolean {
  return lm.visibility === undefined || lm.visibility >= MIN_VISIBILITY
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// EMA time constant is ≈ T/3; convert to a per-frame blend factor for this dt.
function emaAlpha(dt: number, tau: number): number {
  return tau <= 0 ? 1 : 1 - Math.exp(-dt / tau)
}
