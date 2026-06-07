Interview me and ask targeted questions to refine the prompt below. After collecting my answers, rewrite it as a clear multi-paragraph prompt for an AI coding agent to "complete" the issue (and not "investigate").  Do not write a plan. Do not suggest files or code to edit. Do not write code or pseudocode. If you want to mention likely root causes, then clearly state this "this is not final findings and you must find the actual issues to make a fix."  Write the final version of the revised prompt to your choice of an appropriately named file ending in `-prompt.md` within prompt-exports/  Maximum paragraphs to write: 7  Prompt to rewrite: 


Make the game mechanics. A single shape will randomly appear (mostly) in the middle of the board for 4 seconds. The user will then use one of the following keyboard entries: "Q", "W", "A", "S"

Upon tapping the keyboard, the shape will animate into the corresponding corner (upper left, upper right, lower left, lower right). If the keyboard is not used, the shape will animate an explosion and the next shape will appear. After 4 seconds, the next shape will appear automatically.

---

Complete the first playable game-mechanics slice for the existing TanStack Start homepage game board. Build a keyboard-response loop using the existing 16×16 board and the existing seven-shape catalog only. The result should be playable on the homepage, not an investigation, and it should preserve the current product scope as a focused board-and-shapes experience. Use Use TanStack Hotkeys for keyboard input.

Each round should randomly choose one of the existing seven allowed shapes, with repeats allowed, and show exactly one new active shape centered as closely as possible within the 16×16 grid while keeping the entire shape inside the board. The player has a 4-second response window. The visible timer/countdown may become a real countdown for this 4-second window, but do not add scoring.

Accept keyboard input only during the active 4-second response window. Map Q/q to the upper-left corner, W/w to the upper-right corner, A/a to the lower-left corner, and S/s to the lower-right corner. When the player presses a valid key in time, animate the active shape into the corresponding corner; the shape should remain there permanently so shapes accumulate in corners over time. After that movement animation finishes, wait approximately .75 second, then start the next round with a newly randomized shape in the center.

If the player does not press a valid key within 4 seconds, play a brief explosion animation at the active shape’s current position, clear that timed-out shape from the board, and then start the next round only after the explosion completes. Movement and explosion animations should be quick, readable, and non-blocking. The next center shape should not appear until the previous movement or explosion sequence has finished.

Keep the implementation accessible and consistent with the existing visual direction. WCAG 2.1 AA remains required, keyboard-only operation must work reliably, and the homepage should remain readable and understandable. Respect reduced-motion preferences by reducing or disabling nonessential animation effects while keeping the game state transitions clear.

Keep target-shape matching, comparison or recognition logic, scoring, level or difficulty progression, persistence or backend state, and new libraries or frameworks out of scope for this issue. Complete the issue by delivering the working keyboard loop and animations within the existing project stack and the existing homepage game experience.
