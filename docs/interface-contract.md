# Human-Tetris — Team Interface Contract

Two teams, one boundary: a single React component `<Recognition>`.
**Engine** owns everything game: board, target shape, timers, comparison, scoring, animations, random fallback corners.
**Recognition** is a black box: it watches the body and deterministically emits ONE detection per phase. Nothing else — no attempts, no confidence, no thresholds exposed, no game logic.

## Shared types (both import)

```ts
// Every rotation is its own distinct shape. 7 total.
export type ShapeId =
  | 'SQUARE'
  | 'L_0'
  | 'L_90'
  | 'L_180'
  | 'L_270'
  | 'LINE_V'
  | 'LINE_H'

export type Corner = 'TL' | 'TR' | 'BL' | 'BR'
export type Mode = 'idle' | 'making' | 'pointing'
```

## Shape catalog (the 7 shapes)

Cells are `[col, row]`, origin top-left. This is the shared source of truth for board placement, corner highlights, and what Recognition emits.

```ts
export const SHAPES: Record<ShapeId, [number, number][]> = {
  SQUARE: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ], // ##
  // ##

  L_0: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ], // #.
  // #.
  // ##
  L_90: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
  ], // ###
  // #..
  L_180: [
    [0, 0],
    [1, 0],
    [1, 1],
    [1, 2],
  ], // ##
  // .#
  // .#
  L_270: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ], // ..#
  // ###

  LINE_V: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ], // #
  // #
  // #
  // #
  LINE_H: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ], // ####
}
```

| id       | shape             | blocks |
| -------- | ----------------- | ------ |
| `SQUARE` | 2×2 box           | 4      |
| `L_0`    | L upright         | 4      |
| `L_90`   | L rotated 90° CW  | 4      |
| `L_180`  | L upside-down     | 4      |
| `L_270`  | L rotated 270° CW | 4      |
| `LINE_V` | vertical I        | 4      |
| `LINE_H` | horizontal I      | 4      |

Recognition must map a body pose to exactly one of these 7 ids.

## The boundary

```ts
interface RecognitionProps {
  // Engine -> Recognition
  mode: Mode // tells Recognition what to look for; 'idle' = do nothing

  // Recognition -> Engine (each fires ONCE per phase, deterministic)
  onShapeDetected: (shape: ShapeId) => void // during 'making'
  onPoint: (corner: Corner) => void // during 'pointing'
}
```

Recognition self-renders its own `<video>` preview. Engine gives it a slot, not the camera.

## What each team SUPPLIES

**Engine → Recognition (prop):**

- `mode` — current phase. `making` = detect a body shape, `pointing` = detect a pointed corner, `idle` = nothing.

**Recognition → Engine (callbacks):**

- `onShapeDetected(shapeId)` — fires once when Recognition decides a shape is formed. Reports one of the 7 ids. Recognition does NOT know the target and does NOT judge right/wrong.
- `onPoint(corner)` — fires once when Recognition decides a corner is pointed at.

That's the entire surface. Recognition has no other inputs or outputs.

## Flow (Engine-driven)

1. Engine spawns target `X`, sets `mode='making'`, starts countdown.
2. Recognition fires `onShapeDetected(shape)` once.
   - Engine compares `shape` to `X`:
     - **match** → "right!" animation → `mode='pointing'`.
     - **mismatch** → "wrong!" feedback → Engine drops shape in a **random** corner → `mode='idle'` → next.
3. If countdown ends before any detection → Engine drops shape in a **random** corner → `mode='idle'` → next.
4. `mode='pointing'`: Recognition fires `onPoint(corner)` once → Engine places shape there, clears full rows/cols, speeds up, `mode='idle'` → next.

## Contract rules

- Recognition emits exactly one event per active phase; Engine ignores extras until the next phase.
- All judgement (right/wrong, timing, random fallback, scoring, clearing) lives in the Engine.
- Recognition never sees the target and never touches board/score; Engine never touches camera/landmarks.
