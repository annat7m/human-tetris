# MediaPipe Shape Recognition — Design

> **Scope:** the **shape-detection** half of `<Recognition>` only — mapping a body pose to one of
> the 7 `ShapeId`s during the `making` phase and firing `onShapeDetected(shape)` once.
> Corner pointing (`onPoint`, `Corner`) is a separate teammate's work (`mediapipe-corner-pointing`)
> and is **not** covered here. Boundary defined in [`interface-contract.md`](./interface-contract.md).

## Overview

Player strikes a body **arm pose**; MediaPipe `PoseLandmarker` gives us body landmarks; we reduce
each arm to a discrete state and look the `(left, right)` pair up in a table to get a `ShapeId`.
No ML training — pure geometry. One held, stable pose → exactly one `onShapeDetected` per phase.

```
camera frame ─▶ PoseLandmarker ─▶ arm-state(left) , arm-state(right) ─▶ SHAPE_TABLE ─▶ debounce ─▶ onShapeDetected(id)
```

The 7 shapes and their `ShapeId`s are defined in the interface contract. Recognition does **not**
know the target shape and does **not** judge right/wrong — it just reports what it sees.

## Approach: geometric heuristics on pose landmarks

`@mediapipe/tasks-vision` `PoseLandmarker` returns 33 normalized body landmarks per frame
(coordinates in 0..1). For shapes we only need the arms.

1. Reduce each arm (shoulder → elbow → wrist) to a discrete **arm state**: `UP` / `OUT` / `DOWN` / `BENT`.
2. Look up `(leftArmState, rightArmState)` in a config table → candidate `ShapeId` (or none).
3. **Debounce**: emit only when the candidate stays stable for ~N frames, and only **once per `making` phase**.

## Arm-state extraction

Landmarks used (MediaPipe Pose indices):

| joint | left | right |
|-------|------|-------|
| shoulder | 11 | 12 |
| elbow    | 13 | 14 |
| wrist    | 15 | 16 |

For each arm compute:
- **`armAngle`** — angle of the shoulder → wrist vector (overall arm direction).
- **`elbowAngle`** — bend at the elbow (angle shoulder–elbow–wrist; ~180° = straight).

Map to an `ArmState` using **generous bands (±25–30°)** and wrist-vs-shoulder comparisons in
normalized coordinates, so it tolerates distance from the camera:

| state | condition (rough) |
|-------|-------------------|
| `UP`   | wrist well above shoulder, arm straight |
| `OUT`  | arm roughly horizontal, arm straight |
| `DOWN` | wrist below shoulder, arm straight / relaxed |
| `BENT` | elbow sharply bent (forearm turned inward — e.g. "box overhead" for SQUARE) |

```ts
type ArmState = 'UP' | 'OUT' | 'DOWN' | 'BENT';

function armState(shoulder: Pt, elbow: Pt, wrist: Pt): ArmState {
  const elbowAngle = angleDeg(shoulder, elbow, wrist); // ~180 = straight
  if (elbowAngle < 120) return 'BENT';
  const arm = angleDeg2(shoulder, wrist);              // direction of the whole arm
  if (wrist.y < shoulder.y - 0.1) return 'UP';         // y grows downward in image space
  if (wrist.y > shoulder.y + 0.1) return 'DOWN';
  return 'OUT';
}
```

*(Thresholds are starting points — tune live against the webcam.)*

## Shape lookup table (fill with the team's agreed vocabulary)

The gesture vocabulary is already agreed by the team. Keep the classifier generic and put the
agreed mapping in one table:

```ts
import type { ShapeId } from './types';

// Key = `${leftArmState}|${rightArmState}`
const SHAPE_TABLE: Record<string, ShapeId> = {
  'OUT|OUT':   'LINE_H',
  'UP|UP':     'LINE_V',
  'BENT|BENT': 'SQUARE',
  'UP|OUT':    'L_0',    // the 4 L rotations come from which arm is up vs out + direction —
  'OUT|UP':    'L_90',   // confirm the exact assignment against the team's agreed mapping.
  'DOWN|UP':   'L_180',
  'UP|DOWN':   'L_270',
};

export function classifyShape(left: ArmState, right: ArmState): ShapeId | null {
  return SHAPE_TABLE[`${left}|${right}`] ?? null; // null = no confident shape this frame
}
```

## Debounce + emit-once

```ts
// runs only while mode === 'making'
const buf: (ShapeId | null)[] = [];   // ring buffer, length ~10 (~0.4–0.5s at 20–30fps)
let emittedThisPhase = false;

function onFrame(landmarks) {
  const left  = armState(landmarks[11], landmarks[13], landmarks[15]);
  const right = armState(landmarks[12], landmarks[14], landmarks[16]);
  const shape = classifyShape(left, right);

  buf.push(shape);
  if (buf.length > 10) buf.shift();

  const stable = buf.length === 10 && buf.every(s => s !== null && s === buf[0]);
  if (stable && !emittedThisPhase) {
    emittedThisPhase = true;
    onShapeDetected(buf[0]!);   // exactly one event per phase (contract rule)
  }
}
```

Reset `buf` and `emittedThisPhase` whenever `mode` changes, so each `making` phase emits at most
once. (The Engine ignores extras, but emit-once keeps Recognition honest.)

## Mirroring note

The selfie `<video>` is usually flipped horizontally (`transform: scaleX(-1)`) so it feels like a
mirror — good for UX. **Classify on the raw, unflipped landmark coordinates.** Decide once whether
"left" in `SHAPE_TABLE` means image-left or the player's left, and keep the table consistent. (If
the L rotations come out mirrored during testing, that's the first thing to check.)

## Dependencies & assets

- `npm i @mediapipe/tasks-vision`
- Init: `FilesetResolver.forVisionTasks(<CDN or local wasm path>)` → `PoseLandmarker.createFromOptions`.
- Model: `pose_landmarker_lite.task` (lite is fastest; fine for a single full-body player) in
  `public/models/`, or load from the official URL.
- Options: `runningMode: 'VIDEO'`, `numPoses: 1`. Drive it with `detectForVideo(video, timestamp)`
  from a `requestAnimationFrame` loop.

## Files this work will add

Plugs into the shared `<Recognition>` component (component shell / camera setup are shared / the
teammate's; the pointing path is the teammate's):

- `src/recognition/poseClassifier.ts` — `armState()`, `classifyShape()`, `SHAPE_TABLE`.
- `src/recognition/geometry.ts` — `angleDeg()` and small vector helpers.
- `src/recognition/types.ts` — re-export shared `ShapeId` / `Mode` from the interface contract.

## Verification

Build a tiny standalone **dev harness** page (no Engine needed): render
`<Recognition mode="making" onShapeDetected={console.log} />` and watch the console.

1. Strike each agreed arm pose; confirm the correct `ShapeId` logs **once** per held pose.
2. Confirm it re-logs only after you drop the pose and re-form it (emit-once per phase).
3. Tune the angle bands and debounce length `N` until each pose is reliable at arm's length.

## Risks / time-boxing

- Get `LINE_H`, `LINE_V`, and `SQUARE` rock-solid first — they're the most visually distinct and
  highest-value.
- The 4 **L rotations** are the flakiest part to disambiguate; add them after the three above, and
  lean on `elbowAngle` / arm direction to separate them. If they stay unreliable, reduce the number
  of distinct arm states rather than letting misclassifications through.
