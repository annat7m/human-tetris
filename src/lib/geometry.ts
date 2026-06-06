// Small 2D geometry helpers for pose classification.
// All pose landmarks are normalized to 0..1; y grows downward (image space).

export interface Pt {
  x: number;
  y: number;
}

/**
 * Interior angle (degrees, 0..180) at vertex `b` formed by the points a-b-c.
 * Used for elbow bend: shoulder–elbow–wrist, where ~180° means a straight arm.
 */
export function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb === 0 || magCb === 0) return 180;

  const cos = (abx * cbx + aby * cby) / (magAb * magCb);
  const clamped = Math.min(1, Math.max(-1, cos));
  return (Math.acos(clamped) * 180) / Math.PI;
}
