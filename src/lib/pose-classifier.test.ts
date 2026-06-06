import { describe, expect, it } from "vitest";
import {
  armState,
  classifyShape,
  classifyShapeFromLandmarks,
  type PoseLandmark,
} from "#/lib/pose-classifier";

// Build a 17-entry landmark array from explicit arm joints; everything else is
// a fully-visible dummy. Indices: 11/12 shoulders, 13/14 elbows, 15/16 wrists.
function arms(
  left: [PoseLandmark, PoseLandmark, PoseLandmark],
  right: [PoseLandmark, PoseLandmark, PoseLandmark],
): PoseLandmark[] {
  const lm: PoseLandmark[] = Array.from({ length: 17 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  [lm[11], lm[13], lm[15]] = left;
  [lm[12], lm[14], lm[16]] = right;
  return lm;
}

const p = (x: number, y: number, visibility = 1): PoseLandmark => ({
  x,
  y,
  visibility,
});

describe("armState", () => {
  it("straight arm above the shoulder → UP", () => {
    expect(armState(p(0.4, 0.5), p(0.4, 0.35), p(0.4, 0.2))).toBe("UP");
  });
  it("straight horizontal arm → OUT", () => {
    expect(armState(p(0.4, 0.5), p(0.3, 0.5), p(0.2, 0.5))).toBe("OUT");
  });
  it("straight arm below the shoulder → DOWN", () => {
    expect(armState(p(0.4, 0.5), p(0.4, 0.65), p(0.4, 0.8))).toBe("DOWN");
  });
  it("sharply bent elbow → BENT (wins over up/down)", () => {
    // upper arm up, forearm horizontal inward = ~90° at the elbow
    expect(armState(p(0.4, 0.5), p(0.4, 0.3), p(0.5, 0.3))).toBe("BENT");
  });
});

describe("classifyShape table (docs/mediapipe-shape-recognition.md)", () => {
  it("maps each agreed arm-state pair to its shape", () => {
    expect(classifyShape("OUT", "OUT")).toBe("LINE_H");
    expect(classifyShape("UP", "UP")).toBe("LINE_V");
    expect(classifyShape("BENT", "BENT")).toBe("SQUARE");
    expect(classifyShape("UP", "OUT")).toBe("L_0");
    expect(classifyShape("OUT", "UP")).toBe("L_90");
    expect(classifyShape("OUT", "DOWN")).toBe("L_180");
    expect(classifyShape("DOWN", "OUT")).toBe("L_270");
  });
  it("returns null for unmapped pairs", () => {
    expect(classifyShape("DOWN", "DOWN")).toBeNull();
    expect(classifyShape("UP", "DOWN")).toBeNull();
  });
});

describe("classifyShapeFromLandmarks", () => {
  it("detects SQUARE from a box-overhead pose", () => {
    const lm = arms(
      [p(0.4, 0.5), p(0.4, 0.3), p(0.5, 0.3)], // left: bent
      [p(0.6, 0.5), p(0.6, 0.3), p(0.5, 0.3)], // right: bent
    );
    expect(classifyShapeFromLandmarks(lm)).toBe("SQUARE");
  });
  it("detects L_180 from left-OUT + right-DOWN", () => {
    const lm = arms(
      [p(0.4, 0.5), p(0.3, 0.5), p(0.2, 0.5)], // left: out
      [p(0.6, 0.5), p(0.6, 0.65), p(0.6, 0.8)], // right: down
    );
    expect(classifyShapeFromLandmarks(lm)).toBe("L_180");
  });
  it("returns null when an arm landmark is not visible", () => {
    const lm = arms(
      [p(0.4, 0.5), p(0.4, 0.35), p(0.4, 0.2, 0.1)], // left wrist invisible
      [p(0.6, 0.5), p(0.6, 0.35), p(0.6, 0.2)],
    );
    expect(classifyShapeFromLandmarks(lm)).toBeNull();
  });
  it("returns null for a too-short landmark array", () => {
    expect(classifyShapeFromLandmarks([])).toBeNull();
    expect(classifyShapeFromLandmarks(undefined)).toBeNull();
  });
});
