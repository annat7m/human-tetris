## Final Prompt
<taskname="Keyboard Loop"/>
<task>Complete the first playable game-mechanics slice for the existing TanStack Start homepage game board. Implement a keyboard-response loop on the homepage using the existing 16x16 board and existing seven-shape catalog only. Each round should pick one random shape, center it in the 16x16 grid, start a 4-second keyboard response window, map Q/W/A/S to upper-left/upper-right/lower-left/lower-right, animate valid responses to the chosen corner and persist accumulated shapes, then wait about 0.75s before the next round. On timeout, show a brief explosion at the active shape, clear it, and start the next round only after the explosion completes. Do not add scoring, target matching, recognition comparison, levels, persistence/backend, or unrelated frameworks. Preserve WCAG 2.1 AA, keyboard-only reliability, and reduced-motion behavior.</task>

<architecture>
- TanStack Start + React 19 app with file routes in `src/routes`; homepage route is `src/routes/index.tsx` via `createFileRoute('/')`.
- `src/routes/index.tsx` currently owns the full static homepage board experience: local `BOARD_SIZE = 16`, local `PIECES` array with ids, labels, cells, gradients, `BOARD_INDEX`, `hasCell()`, and `HomePage()` rendering the score/timer cards, empty 16x16 board, and piece catalog.
- Global visual system lives in `src/styles.css` with CSS variables for light/dark themes, `page-wrap`, `display-title`, `island-shell`, transitions, and `rise-in` animation. Homepage uses mostly Tailwind classes plus these variables.
- Shared recognition contract exists in `docs/interface-contract.md` and `src/lib/recognition-types.ts`. Recognition is intentionally separate and currently not part of homepage gameplay; `src/components/Recognition.tsx` is only used by `src/routes/test.tsx`.
- Routing shell is in `src/routes/__root.tsx`; it imports global CSS, sets theme init script, renders devtools, and includes `HeadContent`/`Scripts`. `src/router.tsx` creates the router from generated `routeTree.gen`.
- Project uses pnpm, TypeScript strict mode, Vite/TanStack Start/Tailwind/Cloudflare config. `package.json` currently does not list a React TanStack Hotkeys package. Search found no app hotkey usage; `pnpm-lock.yaml` only contains transitive `@solid-primitives/keyboard` references from devtools. AGENTS.md asks implementers to check/load local TanStack Intent skills before substantial TanStack work, but discovery mode was restricted to RepoPrompt MCP tools only and could not run `pnpm dlx` commands.</architecture>

<selected_context>
- `src/routes/index.tsx`: primary edit target. Contains the existing homepage board, shape catalog, board sizing, empty 16x16 cell render, timer/score placeholder cards, and piece catalog UI. Use this full file to add React state/effects, hotkey handling, active/persisted shape rendering, timers, and animations while preserving route conventions.
- `src/styles.css`: global theme and animation styles. Use for any reusable board/game animation classes, reduced-motion media query support, and maintaining visual consistency.
- `package.json`: dependency/scripts metadata. Important because TanStack Hotkeys is requested but not currently present as a dependency; avoid adding unrelated libraries/frameworks.
- `pnpm-lock.yaml` and `pnpm-workspace.yaml`: selected because dependency updates may be needed if a TanStack Hotkeys package is added/resolved.
- `docs/interface-contract.md`: authoritative team contract for shape ids, corners, modes, and exact seven-shape catalog. Also clarifies future recognition/game boundary and out-of-scope matching/scoring flow.
- `src/lib/recognition-types.ts`: shared `ShapeId`, `Corner`, `Mode`, and `SHAPES` implementation matching the contract. Useful if consolidating homepage shape data or correcting catalog drift.
- `prompt-exports/game-mechanics-keyboard-loop-prompt.md`: original detailed issue text with exact keyboard mappings, timing, animation, accessibility, reduced-motion, and out-of-scope constraints.
- `src/routes/__root.tsx`, `src/router.tsx`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `prettier.config.js`, `AGENTS.md`: project conventions, strict TS/lint setup, TanStack Start setup, and local guidance.
- `src/components/Recognition.tsx` and `src/routes/test.tsx`: recognition/test harness context only. These show the recognition boundary and confirm camera/MediaPipe is separate from the homepage keyboard slice.
</selected_context>

<relationships>
- `src/routes/index.tsx` `HomePage()` -> renders board cells from `BOARD_INDEX` and catalog cards from local `PIECES`.
- Local homepage `ShapeDefinition.id` union overlaps with `src/lib/recognition-types.ts` `ShapeId`; `docs/interface-contract.md` is the intended source of truth for the seven ids and cells.
- `src/lib/recognition-types.ts` `RecognitionProps` -> consumed by `src/components/Recognition.tsx` and `src/routes/test.tsx`; this boundary should remain separate from the requested keyboard-only homepage loop.
- `src/routes/__root.tsx` -> imports `src/styles.css?url`, wraps all routes, and controls document shell; homepage styles should remain compatible with this global CSS.
- `package.json` scripts: `pnpm test`, `pnpm lint`, `pnpm build`; strict TS flags in `tsconfig.json` mean new state/effects must avoid unused locals/params and type holes.
</relationships>

<ambiguities>
- TanStack Hotkeys availability/name is unresolved from local files: `package.json` has no `@tanstack/react-hotkeys`/hotkeys dependency and app search found no usage. The next model should verify the intended package/API if tool access is available; if adding it, keep changes scoped to dependency metadata and homepage input handling.
- Shape catalog drift: `docs/interface-contract.md` and `src/lib/recognition-types.ts` define `L_90` as `[[0,0],[1,0],[2,0],[0,1]]` and `L_270` as `[[2,0],[0,1],[1,1],[2,1]]`, but `src/routes/index.tsx` currently defines those two as 2-wide/3-tall variants. Task says use the existing seven-shape catalog only; decide whether “existing” means homepage visuals as currently rendered or the documented/shared source of truth, and avoid creating any new shapes either way.
- Existing homepage has Score and Timer cards. Requirements say no scoring; timer may become a real 4-second countdown. Existing score placeholder can remain static or be repurposed only if it does not introduce scoring/progression.
</ambiguities>

## Selection
- Files: 17 total (17 full)
- Total tokens: 54887 (Auto view)
- Token breakdown: full 54887

### Files
### Selected Files
/Users/david/Developer/Projects/Current/2026-06-06-hackathon/body-blocks/
├── docs/
│   └── interface-contract.md — 1,036 tokens (full)
├── prompt-exports/
│   └── game-mechanics-keyboard-loop-prompt.md — 647 tokens (full)
├── src/
│   ├── components/
│   │   └── Recognition.tsx — 1,486 tokens (full)
│   ├── lib/
│   │   └── recognition-types.ts — 314 tokens (full)
│   ├── routes/
│   │   ├── __root.tsx — 500 tokens (full)
│   │   ├── index.tsx — 1,914 tokens (full)
│   │   └── test.tsx — 1,007 tokens (full)
│   ├── router.tsx — 114 tokens (full)
│   └── styles.css — 1,674 tokens (full)
├── AGENTS.md — 1,344 tokens (full)
├── eslint.config.js — 366 tokens (full)
├── package.json — 465 tokens (full)
├── pnpm-lock.yaml — 43,635 tokens (full)
├── pnpm-workspace.yaml — 15 tokens (full)
├── prettier.config.js — 25 tokens (full)
├── tsconfig.json — 170 tokens (full)
└── vite.config.ts — 175 tokens (full)


---

## Generated Plan

## Chat Send ✅
- **Chat**: `keyboard-loop-A3E139` | **Mode**: plan

### Response
## 1. **Summary**

Implement a targeted homepage-only game loop in `src/routes/index.tsx`: each client-side round selects one of the seven existing shared shapes, displays it centered on the existing 16×16 board, accepts `Q/W/A/S` during a strict 4-second window, animates valid responses into the mapped corner, keeps placed shapes on the board, then starts the next round after ~750ms. Timeouts trigger a brief explosion, clear only the active shape, and start the next round after the explosion completes. Keep recognition, scoring, levels, persistence, and backend untouched. Add only minimal global CSS in `src/styles.css` for board-piece animation and reduced-motion behavior.

## 2. **Current-state analysis**

- `src/routes/index.tsx` currently owns the full homepage board:
  - Local `BOARD_SIZE = 16`.
  - Local `PIECES` array with shape ids, labels, cells, and gradients.
  - `BOARD_INDEX` renders 256 empty cells.
  - `hasCell()` supports the piece catalog preview.
  - No React state/effects exist yet.
- Shape ids overlap with `src/lib/recognition-types.ts`, and `docs/interface-contract.md` identifies `SHAPES` there as the source of truth.
- There is catalog drift:
  - Homepage `L_90` and `L_270` differ from `src/lib/recognition-types.ts`.
  - For this slice, use the existing seven-shape catalog from the shared contract, not new shapes.
- Recognition is intentionally separate:
  - `src/components/Recognition.tsx` is only used by `/test`.
  - Homepage should not import or use Recognition.
- `src/styles.css` already owns global design tokens and animations; reusable gameplay animation classes belong there.
- `package.json` has no TanStack Hotkeys dependency. Do not add a speculative hotkeys package unless the implementer can verify the official package/API first.

## 3. **Design**

### Homepage game state

Use a local reducer or tightly scoped state machine inside `src/routes/index.tsx`. This is a targeted change; no new engine module is needed yet because the game loop is homepage-only and intentionally small.

Core local types:

```ts
type GamePhase =
  | 'boot'
  | 'responding'
  | 'moving'
  | 'exploding'
  | 'between-rounds'

type BoardPosition = { x: number; y: number }

type ActivePiece = {
  uid: number
  shapeId: ShapeId
  origin: BoardPosition
  corner?: Corner
}

type PlacedPiece = {
  uid: number
  shapeId: ShapeId
  origin: BoardPosition
  corner: Corner
}
```

State should own:

- `phase`
- `roundId`
- `nextUid`
- `active: ActivePiece | null`
- `placed: PlacedPiece[]`
- `deadlineAt: number | null`
- `remainingMs`
- `announcement` for accessible live status

Constants:

- `RESPONSE_MS = 4000`
- `MOVE_MS = 360`
- `EXPLOSION_MS = 520`
- `SETTLE_MS = 750`
- Reduced motion:
  - movement becomes immediate or near-immediate
  - explosion becomes a short fade, around `150ms`
  - state sequencing still remains explicit

### Shape catalog source

Modify `src/routes/index.tsx` to import:

- `SHAPES`
- `ShapeId`
- `Corner`

from `#/lib/recognition-types`.

Keep visual metadata local:

- label
- gradient colors

Derive homepage `PIECES` from the shared `SHAPES` plus local metadata. This removes shape drift while preserving the existing seven ids only.

Do not modify:

- `docs/interface-contract.md`
- `src/lib/recognition-types.ts`
- `src/components/Recognition.tsx`

### Placement calculations

Add local pure helpers in `src/routes/index.tsx`:

- `getShapeBounds(shapeId)`
  - computes width/height from `SHAPES[shapeId]`
  - normalizes cells if needed
- `getCenteredOrigin(shapeId)`
  - `x = Math.floor((BOARD_SIZE - width) / 2)`
  - `y = Math.floor((BOARD_SIZE - height) / 2)`
- `getCornerOrigin(shapeId, corner)`
  - `TL`: `{ x: 0, y: 0 }`
  - `TR`: `{ x: BOARD_SIZE - width, y: 0 }`
  - `BL`: `{ x: 0, y: BOARD_SIZE - height }`
  - `BR`: `{ x: BOARD_SIZE - width, y: BOARD_SIZE - height }`

No collision detection, row clearing, or scoring should be added. If multiple pieces go to the same corner, they may overlap; this is acceptable for this slice because placement/collision systems are out of scope.

### Round lifecycle

Client-only start is required to avoid SSR hydration mismatch from random shape selection.

Flow:

1. Initial render:
   - `phase = 'boot'`
   - no active shape
   - status says the game is getting ready
2. First client `useEffect`:
   - guarded by a ref so React Strict Mode does not start duplicate rounds
   - calls `startRound()`
3. `startRound()`:
   - picks a random `ShapeId` from the seven shared ids
   - creates an active piece centered in the board
   - sets `deadlineAt = performance.now() + 4000`
   - sets `phase = 'responding'`
4. During `responding`:
   - countdown updates every ~100ms
   - valid key before deadline starts movement
   - timeout starts explosion
5. Valid key:
   - phase becomes `moving`
   - active piece origin changes from center to target corner
   - keyboard input is ignored immediately afterward
   - after movement duration, active piece is appended to `placed`
   - active is cleared
   - phase becomes `between-rounds`
   - after `750ms`, next round starts
6. Timeout:
   - phase becomes `exploding`
   - active shape remains at center during explosion
   - after explosion duration, active is cleared
   - next round starts immediately after explosion completes

### Keyboard input

Map:

```ts
q -> TL
w -> TR
a -> BL
s -> BR
```

Input must be accepted only when:

- `phase === 'responding'`
- `active !== null`
- `performance.now() < deadlineAt`

Ignore:

- invalid keys
- repeated keydown events
- valid keys after phase changes
- stale timeout callbacks from old rounds

If an official TanStack Hotkeys React package/API can be verified during implementation, use it only as the event source and keep all game-state guards in the homepage handler. If it cannot be verified, do not add a speculative dependency; use a scoped `window` `keydown` listener and leave package files unchanged.

### Rendering model

Keep the existing 16×16 grid as the visual board background, but make each empty cell `aria-hidden`.

Add absolutely positioned piece layers inside the same relative board grid:

- placed pieces render first
- active piece renders above placed pieces
- explosion state renders the active piece with explosion classes

Each piece layer:

- positions itself using CSS variables or inline style based on board origin
- uses `--cell-size` from the board grid
- renders only occupied shape cells
- uses the existing gradient metadata

The active moving piece should keep the same React `key` while its origin changes, so CSS transition animates from center to corner.

### Accessibility

Update homepage UI:

- Replace the misleading `Score` card with a non-scoring card, e.g. `Controls`.
- Timer card becomes a real countdown during the response window.
- Add visible instructions: `Q upper-left · W upper-right · A lower-left · S lower-right`.
- Add `aria-live="polite"` status text for:
  - new round active shape
  - successful corner placement
  - timeout/explosion
- Board should have a single useful accessible label/description instead of 256 repeated cell labels.
- Do not use `role="application"` unless there is a strong reason; global keyboard handling plus clear instructions is sufficient here.
- Preserve keyboard-only reliability by not requiring pointer interaction or board focus.

### CSS / reduced motion

Add new classes in `src/styles.css` for:

- piece positioning
- block visual styling
- movement transition
- explosion animation
- reduced-motion overrides

Behavior:

- Normal motion:
  - movement transition around `360ms`
  - explosion around `520ms`
- Reduced motion:
  - movement transition disabled or nearly instant
  - explosion becomes a short opacity/outline change without scale/particle motion
  - state transitions still occur in the same order

## 4. **File-by-file impact**

### `src/routes/index.tsx`

Modify.

Changes:

- Add React hooks imports.
- Import `ShapeId`, `Corner`, and `SHAPES` from `#/lib/recognition-types`.
- Replace local shape-id union with imported `ShapeId`.
- Replace local hardcoded cells with shared `SHAPES`.
- Keep local labels/gradients as visual metadata.
- Add local game constants.
- Add local placement helpers.
- Add local reducer/state machine.
- Add client-only round bootstrap effect.
- Add countdown/timeout effects.
- Add keyboard input effect or verified TanStack Hotkeys hook.
- Render:
  - live controls/status card instead of score
  - real countdown timer
  - board grid with placed and active piece overlays
  - accessible live announcement
  - existing piece catalog, now derived from shared shapes

Depends on:

- `src/styles.css` animation classes.

### `src/styles.css`

Modify.

Changes:

- Add gameplay piece classes.
- Add movement transition.
- Add explosion keyframes.
- Add reduced-motion overrides for new gameplay animations only.
- Keep existing theme variables and global animations intact.

Depends on:

- CSS class names used by `src/routes/index.tsx`.

### `package.json`

Default plan: no change.

Only modify if the implementer verifies an official TanStack Hotkeys React package and its API. Do not add non-TanStack hotkey libraries.

### `pnpm-lock.yaml`

Default plan: no change.

Only update if `package.json` receives a verified official hotkeys dependency.

## 5. **Risks and migration**

- No persistence or schema migration is introduced.
- Shape drift correction may visually change `L_90` and `L_270` on the homepage; this is intentional because the shared contract is the source of truth.
- Keyboard dependency ambiguity remains the main implementation risk:
  - validate official TanStack Hotkeys availability before dependency changes
  - otherwise use native keyboard handling without adding libraries
- SSR hydration risk is avoided by starting random rounds only after client mount.

## Orchestration status

- [x] Homepage keyboard-response loop implemented in `src/routes/index.tsx`.
- [x] User correction applied: preserved the homepage's existing seven shape definitions instead of switching to the shared recognition catalog.
- [x] `@tanstack/react-hotkeys` added and used for input.
- [x] Movement, timeout explosion, accumulation, countdown, accessibility status, and reduced-motion styling added.
- [x] Builder reported `pnpm lint`, `pnpm test`, and `pnpm build` all passed.
- [x] Orchestrator spot-check confirmed homepage `PIECES` definitions remain local and unchanged in shape cells; Hotkeys package normalizes lowercase letter events to uppercase canonical hotkeys.

## 6. **Implementation order**

1. Validate local TanStack guidance if tool access is available:
   - run the repo’s TanStack Intent skill check from `AGENTS.md`
   - separately verify whether an official TanStack Hotkeys React package exists
2. Update `src/routes/index.tsx` shape data to derive cells from `src/lib/recognition-types.ts`.
3. Add placement helpers and local game types/constants.
4. Add reducer/state machine and client-only first-round bootstrap.
5. Add countdown and timeout effects with stale-round guards.
6. Add keyboard input handling with exact `Q/W/A/S` mapping and strict deadline checks.
7. Update board rendering to include placed and active piece overlays.
8. Replace score placeholder with controls/status UI and make timer live.
9. Add CSS movement/explosion/reduced-motion classes in `src/styles.css`.
10. Run:
    - `pnpm lint`
    - `pnpm test`
    - `pnpm build`


> 💡 Continue this plan conversation with ask_oracle(chat_id: "keyboard-loop-A3E139", new_chat: false)