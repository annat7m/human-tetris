// Shared types — the boundary between Engine and Recognition.
// Source of truth: docs/interface-contract.md

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

// Cells are [col, row], origin top-left.
export const SHAPES: Record<ShapeId, [number, number][]> = {
  SQUARE: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  L_0: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  L_90: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
  ],
  L_180: [
    [0, 0],
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  L_270: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  LINE_V: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  LINE_H: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
}

export interface RecognitionProps {
  // Engine -> Recognition
  mode: Mode

  // Recognition -> Engine (each fires ONCE per phase, deterministic)
  onShapeDetected?: (shape: ShapeId) => void // during 'making'
  onPoint?: (corner: Corner) => void // during 'pointing'
}
