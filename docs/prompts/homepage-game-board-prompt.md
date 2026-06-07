Interview me and ask targeted questions to refine the prompt below. After collecting my answers, rewrite it as a clear multi-paragraph prompt for an AI coding agent to "complete" the issue (and not "investigate").  Do not write a plan. Do not suggest files or code to edit. Do not write code or pseudocode. If you want to mention likely root causes, then clearly state this "this is not final findings and you must find the actual issues to make a fix."  Write the final version of the revised prompt to your choice of an appropriately named file ending in `-prompt.md` within prompt-exports/  Maximum paragraphs to write: 7  Prompt to rewrite: 

Make the start of a game that will have a Game board of 16x16 that allows for only 7 shapes to exist on it. I do not want to consider anything other than the game board and it's exlcusive display on the TanStack Start homepage. 

At this time, do not consider any other libraries or frameworks. At this time, do not consider other game mechanics including, but limited to:
- target shape
- timers
- comparison
- scoring
- animations

Shapes:
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


Goal: A game board that allows for only 7 shapes to exist on it. A nice looking game board centered on the page. Space on the page using a mock "Score" and a mock "Timer" (aka Countdown). The page needs to be WCAG 2.1 AA compliant. Pick the colors and typography to match the TanStack Start homepage.


---


Complete the first visible slice of the Human Tetris game on the TanStack Start homepage. Build a static, polished homepage experience centered around a 16×16 game board and the seven-shape catalog only. The homepage should be the primary user-facing experience for this issue; shared components are acceptable if useful, but do not add other pages or broaden the product beyond this homepage board presentation.

The board must be an empty 16×16 grid at initial render. It should be centered, responsive, visually clear, and easy to scan. Do not implement placement, dragging, recognition, target matching, comparison, scoring rules, timers, countdown behavior, animations, or any other gameplay mechanics. Include visible mock “Score” and mock “Timer” UI placeholders only; they must be non-functional and must not update or imply active game logic.

Only these seven shape IDs may exist in the shape source of truth and in any visible shape-related UI: SQUARE, L_0, L_90, L_180, L_270, LINE_V, and LINE_H. Their cells use [col, row] coordinates with the origin at the top-left: SQUARE = [0,0], [1,0], [0,1], [1,1]; L_0 = [0,0], [0,1], [0,2], [1,2]; L_90 = [0,0], [1,0], [2,0], [0,1]; L_180 = [0,0], [1,0], [1,1], [1,2]; L_270 = [2,0], [0,1], [1,1], [2,1]; LINE_V = [0,0], [0,1], [0,2], [0,3]; LINE_H = [0,0], [1,0], [2,0], [3,0]. Do not introduce any additional shape IDs, rotations, variants, or derived gameplay objects.

Show the seven allowed shapes as a compact catalog or palette near the board so a user can visually understand the allowed pieces without interacting with them. Each shape should be rendered from square cells, each shape should have a distinct color, and each square cell within a shape should have a subtle gradient that suggests a light source from the upper right. Keep the catalog presentational only; it should not be draggable, selectable, or tied to game-state mechanics.

Style the experience to feel at home with the existing TanStack Start homepage aesthetic while prioritizing accessibility over decoration. The layout should be centered and responsive, the 16×16 grid must remain readable across reasonable viewport sizes, and text, controls, placeholders, grid lines, and shape colors must meet WCAG 2.1 AA expectations for contrast and readability. Avoid animations.

Complete the issue by delivering a working homepage UI that builds successfully and stays within the existing TanStack Start, React, TypeScript, and Tailwind setup. Do not add new runtime libraries or frameworks for this slice unless they are already part of the project and genuinely necessary. The finished result should be a clean, accessible, static foundation for the game board and seven allowed shapes, not an investigation and not a prototype of future mechanics.
