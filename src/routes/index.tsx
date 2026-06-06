import { useCallback, useEffect, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SHAPES } from '#/lib/recognition-types'
import type {
  Corner,
  Mode,
  RecognitionProps,
  ShapeId,
} from '#/lib/recognition-types'

// ---------------------------------------------------------------------------
// Constants & tuning
// ---------------------------------------------------------------------------

const BOARD_SIZE = 16
const TICK_MS = 100
const MOVE_MS = 360
const REDUCED_MOVE_MS = 60

// Idle "cue" beats between active phases so Recognition never re-arms instantly
// and the player gets a beat to read the big on-screen prompt.
const PREP_MS = 1_900 // "make this shape" cue before shape detection arms
const MATCH_CUE_MS = 1_600 // "matched!" cue before corner pointing arms
const SETTLE_MS = 1_000 // beat after a piece lands / lines clear

// Phase deadlines shrink as lines pile up (the "speed up" rule), with a floor.
const BASE_MAKING_MS = 14_000
const BASE_POINTING_MS = 10_000
const MIN_MAKING_MS = 8_000
const MIN_POINTING_MS = 6_000
const SPEEDUP_PER_LINE_MS = 250

const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[]
const CORNERS: readonly Corner[] = ['TL', 'TR', 'BL', 'BR']

const CORNER_LABELS: Record<Corner, string> = {
  TL: 'upper-left',
  TR: 'upper-right',
  BL: 'lower-left',
  BR: 'lower-right',
}

// Presentation only. Cell geometry is owned by SHAPES (the contract source of
// truth); here we keep just the gradient + a pose hint label, keyed by ShapeId.
// The label describes how to FORM the shape with your body (left/right are your
// own arms), derived from the pose classifier's arm table.
const SHAPE_VISUALS: Record<
  ShapeId,
  {
    label: string
    pose: string
    gradient: { highlight: string; base: string; shadow: string }
  }
> = {
  SQUARE: {
    label: 'Square',
    pose: 'both arms bent in',
    gradient: { highlight: '#ffe9a3', base: '#efbf3c', shadow: '#c68f09' },
  },
  L_0: {
    label: 'L',
    pose: 'left arm up · right arm out',
    gradient: { highlight: '#a6e3ff', base: '#3a9ed8', shadow: '#1f67a5' },
  },
  L_90: {
    label: 'L turned',
    pose: 'left arm out · right arm up',
    gradient: { highlight: '#ffc2c5', base: '#eb6c72', shadow: '#ab2f35' },
  },
  L_180: {
    label: 'L flipped',
    pose: 'left arm out · right arm down',
    gradient: { highlight: '#c8f0c6', base: '#6bcf72', shadow: '#2e9f47' },
  },
  L_270: {
    label: 'L rotated',
    pose: 'left arm down · right arm out',
    gradient: { highlight: '#ffdab0', base: '#f49c45', shadow: '#bd5f12' },
  },
  LINE_V: {
    label: 'Tall line',
    pose: 'both arms up',
    gradient: { highlight: '#cfb9ff', base: '#8d73e0', shadow: '#563ca0' },
  },
  LINE_H: {
    label: 'Wide line',
    pose: 'both arms out',
    gradient: { highlight: '#ffccf0', base: '#ed74c5', shadow: '#ad2d85' },
  },
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Cells = readonly [number, number][]
type Board = (ShapeId | null)[]
type Origin = { x: number; y: number }

// 'idle'      camera off — start screen
// 'ready'     camera on, awaiting the player to begin a round
// 'prep'      target shown, "make this!" cue; shape detection NOT armed yet (mode='idle')
// 'making'    forming the body shape (Recognition mode='making')
// 'matched'   "matched!" cue; pointing NOT armed yet (mode='idle')
// 'pointing'  pointing to a corner (Recognition mode='pointing')
// 'moving'    matched/failed piece sliding into its corner (mode='idle')
// 'settle'    beat after placement / line clears (mode='idle')
// 'gameover'  no room left to drop a piece
type GamePhase =
  | 'idle'
  | 'ready'
  | 'prep'
  | 'making'
  | 'matched'
  | 'pointing'
  | 'moving'
  | 'settle'
  | 'gameover'

type ActivePiece = {
  uid: number
  shapeId: ShapeId
  origin: Origin
  corner?: Corner
}

type Feedback = { kind: 'right' | 'wrong' | 'info'; text: string }

type GameState = {
  phase: GamePhase
  board: Board
  active: ActivePiece | null
  nextUid: number
  score: number
  lines: number
  deadlineAt: number | null
  remainingMs: number
  phaseTotalMs: number
  feedback: Feedback | null
  announcement: string
}

// ---------------------------------------------------------------------------
// Pure board helpers (geometry driven by SHAPES)
// ---------------------------------------------------------------------------

const cellIndex = (x: number, y: number) => y * BOARD_SIZE + x

function createBoard(): Board {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null)
}

function shapeBounds(cells: Cells) {
  const maxX = Math.max(...cells.map(([x]) => x))
  const maxY = Math.max(...cells.map(([, y]) => y))
  return { width: maxX + 1, height: maxY + 1 }
}

function centeredOrigin(cells: Cells): Origin {
  const { width, height } = shapeBounds(cells)
  return {
    x: Math.floor((BOARD_SIZE - width) / 2),
    y: Math.floor((BOARD_SIZE - height) / 2),
  }
}

function fits(cells: Cells, origin: Origin, board: Board): boolean {
  return cells.every(([cx, cy]) => {
    const x = origin.x + cx
    const y = origin.y + cy
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false
    return board[cellIndex(x, y)] === null
  })
}

// Origins scanned in the order a piece "falls" toward the given corner, so the
// first one that fits stacks the piece against existing blocks.
function cornerOrderedOrigins(cells: Cells, corner: Corner): Origin[] {
  const { width, height } = shapeBounds(cells)
  const xs = Array.from({ length: BOARD_SIZE - width + 1 }, (_, x) => x)
  const ys = Array.from({ length: BOARD_SIZE - height + 1 }, (_, y) => y)
  if (corner === 'TR' || corner === 'BR') xs.reverse()
  if (corner === 'BL' || corner === 'BR') ys.reverse()
  return ys.flatMap((y) => xs.map((x) => ({ x, y })))
}

function stackedOrigin(
  cells: Cells,
  corner: Corner,
  board: Board,
): Origin | null {
  return cornerOrderedOrigins(cells, corner).find((o) => fits(cells, o, board)) ?? null
}

// Try the requested corner first; if it's full, fall back to any corner that
// can still take the piece. Null means the board is out of room (game over).
function resolvePlacement(
  cells: Cells,
  preferred: Corner,
  board: Board,
): { origin: Origin; corner: Corner } | null {
  const order: Corner[] = [preferred, ...CORNERS.filter((c) => c !== preferred)]
  for (const corner of order) {
    const origin = stackedOrigin(cells, corner, board)
    if (origin) return { origin, corner }
  }
  return null
}

function commit(
  board: Board,
  cells: Cells,
  origin: Origin,
  shapeId: ShapeId,
): Board {
  const next = board.slice()
  cells.forEach(([cx, cy]) => {
    next[cellIndex(origin.x + cx, origin.y + cy)] = shapeId
  })
  return next
}

// Clear any fully-filled rows AND columns (no gravity — corner stacking makes a
// blast-style clear the natural fit). Returns the new board + line count.
function clearLines(board: Board): { board: Board; cleared: number } {
  const fullRows: number[] = []
  const fullCols: number[] = []

  for (let y = 0; y < BOARD_SIZE; y++) {
    let full = true
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[cellIndex(x, y)] === null) {
        full = false
        break
      }
    }
    if (full) fullRows.push(y)
  }
  for (let x = 0; x < BOARD_SIZE; x++) {
    let full = true
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (board[cellIndex(x, y)] === null) {
        full = false
        break
      }
    }
    if (full) fullCols.push(x)
  }

  if (fullRows.length === 0 && fullCols.length === 0) {
    return { board, cleared: 0 }
  }

  const next = board.slice()
  fullRows.forEach((y) => {
    for (let x = 0; x < BOARD_SIZE; x++) next[cellIndex(x, y)] = null
  })
  fullCols.forEach((x) => {
    for (let y = 0; y < BOARD_SIZE; y++) next[cellIndex(x, y)] = null
  })
  return { board: next, cleared: fullRows.length + fullCols.length }
}

function randomShape(): ShapeId {
  return SHAPE_IDS[Math.floor(Math.random() * SHAPE_IDS.length)]
}

function randomCorner(): Corner {
  return CORNERS[Math.floor(Math.random() * CORNERS.length)]
}

function makingMs(lines: number) {
  return Math.max(MIN_MAKING_MS, BASE_MAKING_MS - lines * SPEEDUP_PER_LINE_MS)
}

function pointingMs(lines: number) {
  return Math.max(MIN_POINTING_MS, BASE_POINTING_MS - lines * SPEEDUP_PER_LINE_MS)
}

function modeForPhase(phase: GamePhase): Mode {
  if (phase === 'making') return 'making'
  if (phase === 'pointing') return 'pointing'
  return 'idle'
}

function formatRemaining(ms: number) {
  return `${Math.max(0, ms / 1_000).toFixed(1)}s`
}

type Cue = {
  tone: 'good' | 'bad' | 'info'
  title: string
  subtitle?: string
  shapeId?: ShapeId
}

// Derive the big on-screen transition cue from the current phase. Only the
// idle-mode beats (prep / matched / moving / settle) produce one, so the cue
// never covers the live preview while detection is actually running.
function getCue(
  game: GameState,
  target: ShapeId | null,
  targetVisual: (typeof SHAPE_VISUALS)[ShapeId] | null,
): Cue | null {
  if (game.phase === 'prep' && target && targetVisual) {
    return { tone: 'info', title: 'MAKE THIS', subtitle: targetVisual.pose, shapeId: target }
  }
  if (game.phase === 'matched') {
    return { tone: 'good', title: 'MATCHED!', subtitle: 'Point to a corner next' }
  }
  if (game.phase === 'moving' || game.phase === 'settle') {
    if (game.feedback?.kind === 'wrong') {
      return { tone: 'bad', title: 'MISSED', subtitle: game.feedback.text }
    }
    if (game.feedback?.kind === 'right') {
      return /cleared/i.test(game.feedback.text)
        ? { tone: 'good', title: game.feedback.text }
        : { tone: 'good', title: 'NICE!', subtitle: game.feedback.text }
    }
  }
  return null
}

// Resolve a drop into the 'moving' phase (slide animation), or game over if the
// board can't take the piece anywhere.
function beginDrop(
  cur: GameState,
  preferred: Corner,
  kind: Feedback['kind'],
  feedbackText: string,
  announcement: string,
): GameState {
  if (!cur.active) return cur
  const cells = SHAPES[cur.active.shapeId]
  const placement = resolvePlacement(cells, preferred, cur.board)
  if (!placement) {
    return {
      ...cur,
      phase: 'gameover',
      deadlineAt: null,
      remainingMs: 0,
      feedback: { kind: 'wrong', text: 'Board full!' },
      announcement: 'No room left to place a piece. Game over.',
    }
  }
  return {
    ...cur,
    phase: 'moving',
    active: { ...cur.active, origin: placement.origin, corner: placement.corner },
    deadlineAt: null,
    remainingMs: 0,
    feedback: { kind, text: feedbackText },
    announcement,
  }
}

function initialState(): GameState {
  return {
    phase: 'idle',
    board: createBoard(),
    active: null,
    nextUid: 1,
    score: 0,
    lines: 0,
    deadlineAt: null,
    remainingMs: 0,
    phaseTotalMs: 0,
    feedback: null,
    announcement: 'Enable the camera to play.',
  }
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reducedMotion
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/')({ component: HomePage })

const BOARD_INDEX = Array.from({ length: BOARD_SIZE * BOARD_SIZE })

function HomePage() {
  const reducedMotion = useReducedMotion()
  const moveDuration = reducedMotion ? REDUCED_MOVE_MS : MOVE_MS

  const [game, setGame] = useState<GameState>(initialState)
  const [cameraOn, setCameraOn] = useState(false)

  // Recognition pulls in browser-only MediaPipe + getUserMedia, so load it
  // lazily on the client (SSR-safe) and keep it mounted for the whole session.
  const [Recognition, setRecognition] =
    useState<ComponentType<RecognitionProps> | null>(null)

  useEffect(() => {
    if (!cameraOn || Recognition) return
    let active = true
    import('#/components/Recognition').then((mod) => {
      if (active) setRecognition(() => mod.default)
    })
    return () => {
      active = false
    }
  }, [cameraOn, Recognition])

  const mode = modeForPhase(game.phase)

  // Spawn a new target and show the "make this!" cue. Shape detection arms only
  // after the prep beat (see the prep effect) so it never starts instantly.
  const startRound = useCallback(() => {
    setGame((prev) => {
      if (prev.phase === 'gameover') return prev
      const shapeId = randomShape()
      return {
        ...prev,
        phase: 'prep',
        active: {
          uid: prev.nextUid,
          shapeId,
          origin: centeredOrigin(SHAPES[shapeId]),
        },
        nextUid: prev.nextUid + 1,
        deadlineAt: null,
        remainingMs: 0,
        phaseTotalMs: 0,
        feedback: null,
        announcement: `Get ready — form the ${SHAPE_VISUALS[shapeId].label}: ${SHAPE_VISUALS[shapeId].pose}.`,
      }
    })
  }, [])

  const handleStart = useCallback(() => {
    setCameraOn(true)
    setGame((prev) => ({
      ...prev,
      phase: 'ready',
      announcement: 'Allow the camera, stand back so your arms are visible, then begin.',
    }))
  }, [])

  const handlePlayAgain = useCallback(() => {
    setGame(() => ({
      ...initialState(),
      phase: 'ready',
      announcement: 'Begin when ready.',
    }))
  }, [])

  // Recognition reports a formed shape during 'making'.
  const handleShapeDetected = useCallback((shape: ShapeId) => {
    setGame((cur) => {
      if (cur.phase !== 'making' || !cur.active) return cur
      if (shape === cur.active.shapeId) {
        return {
          ...cur,
          phase: 'matched',
          deadlineAt: null,
          remainingMs: 0,
          phaseTotalMs: 0,
          feedback: { kind: 'right', text: 'Matched!' },
          announcement: 'Shape matched. Get ready to point at a corner.',
        }
      }
      return beginDrop(
        cur,
        randomCorner(),
        'wrong',
        `That read as ${SHAPE_VISUALS[shape].label}.`,
        `Wrong shape — dropping the ${SHAPE_VISUALS[cur.active.shapeId].label} in a random corner.`,
      )
    })
  }, [])

  // Recognition reports a pointed corner during 'pointing'.
  const handlePoint = useCallback((corner: Corner) => {
    setGame((cur) => {
      if (cur.phase !== 'pointing' || !cur.active) return cur
      return beginDrop(
        cur,
        corner,
        'right',
        `Dropping to the ${CORNER_LABELS[corner]} corner.`,
        `Placing the piece in the ${CORNER_LABELS[corner]} corner.`,
      )
    })
  }, [])

  // After the prep cue, arm shape detection and start the making countdown.
  const activeUid = game.active?.uid
  useEffect(() => {
    if (game.phase !== 'prep') return
    const timeout = window.setTimeout(() => {
      setGame((cur) => {
        if (cur.phase !== 'prep' || !cur.active || cur.active.uid !== activeUid) {
          return cur
        }
        const ms = makingMs(cur.lines)
        return {
          ...cur,
          phase: 'making',
          deadlineAt: performance.now() + ms,
          remainingMs: ms,
          phaseTotalMs: ms,
          announcement: `Form the ${SHAPE_VISUALS[cur.active.shapeId].label} now.`,
        }
      })
    }, PREP_MS)
    return () => window.clearTimeout(timeout)
  }, [game.phase, activeUid])

  // After the matched cue, arm pointing and start the pointing countdown.
  useEffect(() => {
    if (game.phase !== 'matched') return
    const timeout = window.setTimeout(() => {
      setGame((cur) => {
        if (cur.phase !== 'matched' || !cur.active || cur.active.uid !== activeUid) {
          return cur
        }
        const ms = pointingMs(cur.lines)
        return {
          ...cur,
          phase: 'pointing',
          deadlineAt: performance.now() + ms,
          remainingMs: ms,
          phaseTotalMs: ms,
          announcement: 'Point an arm at a corner to drop the piece.',
        }
      })
    }, MATCH_CUE_MS)
    return () => window.clearTimeout(timeout)
  }, [game.phase, activeUid])

  // Countdown + timeout for the making/pointing phases.
  useEffect(() => {
    if (
      (game.phase !== 'making' && game.phase !== 'pointing') ||
      game.deadlineAt === null
    ) {
      return
    }

    const deadline = game.deadlineAt
    const phase = game.phase
    const uid = game.active?.uid

    const tick = () => {
      setGame((cur) => {
        if (cur.phase !== phase || cur.active?.uid !== uid) return cur
        return { ...cur, remainingMs: Math.max(0, deadline - performance.now()) }
      })
    }

    tick()
    const interval = window.setInterval(tick, TICK_MS)
    const timeout = window.setTimeout(
      () => {
        setGame((cur) => {
          if (cur.phase !== phase || cur.active?.uid !== uid) return cur
          return beginDrop(
            cur,
            randomCorner(),
            'wrong',
            'Time up!',
            phase === 'making'
              ? 'Out of time — dropping the shape in a random corner.'
              : 'Out of time — dropping in a random corner.',
          )
        })
      },
      Math.max(0, deadline - performance.now()),
    )

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [game.phase, game.deadlineAt, game.active?.uid])

  // After the slide finishes, commit the piece, clear lines, then settle.
  const movingUid = game.active?.uid
  const movingCorner = game.active?.corner
  useEffect(() => {
    if (game.phase !== 'moving' || movingUid === undefined || movingCorner === undefined) {
      return
    }
    const uid = movingUid
    const timeout = window.setTimeout(() => {
      setGame((cur) => {
        if (
          cur.phase !== 'moving' ||
          !cur.active ||
          cur.active.uid !== uid ||
          cur.active.corner === undefined
        ) {
          return cur
        }
        const cells = SHAPES[cur.active.shapeId]
        const committed = commit(cur.board, cells, cur.active.origin, cur.active.shapeId)
        const { board: nextBoard, cleared } = clearLines(committed)
        const gained = cells.length + cleared * 100
        return {
          ...cur,
          phase: 'settle',
          board: nextBoard,
          active: null,
          score: cur.score + gained,
          lines: cur.lines + cleared,
          feedback:
            cleared > 0
              ? {
                  kind: 'right',
                  text: `${cleared} line${cleared > 1 ? 's' : ''} cleared!`,
                }
              : cur.feedback,
          announcement:
            cleared > 0 ? `${cleared} lines cleared.` : 'Piece placed.',
        }
      })
    }, moveDuration)
    return () => window.clearTimeout(timeout)
  }, [game.phase, movingUid, movingCorner, moveDuration])

  // Brief beat after a placement, then spawn the next round.
  useEffect(() => {
    if (game.phase !== 'settle') return
    const timeout = window.setTimeout(startRound, SETTLE_MS)
    return () => window.clearTimeout(timeout)
  }, [game.phase, startRound])

  const isTimed = game.phase === 'making' || game.phase === 'pointing'
  const timerLabel = isTimed ? formatRemaining(game.remainingMs) : '—'
  const timerFraction =
    isTimed && game.phaseTotalMs > 0
      ? Math.max(0, Math.min(1, game.remainingMs / game.phaseTotalMs))
      : 0
  const timerLow = isTimed && game.remainingMs <= 2_000

  const target = game.active?.shapeId ?? null
  const targetVisual = target ? SHAPE_VISUALS[target] : null

  const cue = getCue(game, target, targetVisual)

  return (
    <main className="page-wrap px-4 py-5 sm:py-8">
      <section className="island-shell rounded-[1.5rem] p-4 sm:p-6">
        <h1 className="display-title mb-1 text-center text-5xl leading-none font-bold text-[var(--sea-ink)] sm:text-7xl">
          Human Tetris
        </h1>
        <p className="mb-4 text-center text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Form the shape with your body, then point an arm at a corner to drop it.
        </p>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {game.announcement}
        </p>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)_minmax(15rem,18rem)]">
          {/* Camera */}
          <section
            aria-label="Camera"
            className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--chip-line)] bg-black/80"
          >
            {cameraOn && Recognition ? (
              <Recognition
                mode={mode}
                onShapeDetected={handleShapeDetected}
                onPoint={handlePoint}
              />
            ) : null}

            {!cameraOn ? (
              <div className="absolute inset-0 grid place-items-center bg-[var(--chip-bg)] p-6 text-center">
                <div>
                  <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
                    This game uses your webcam to read your body pose. Nothing
                    leaves your device.
                  </p>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="rounded-full border border-[rgba(50,143,151,0.5)] bg-[rgba(79,184,178,0.24)] px-5 py-2 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.38)]"
                  >
                    Enable camera
                  </button>
                </div>
              </div>
            ) : null}

            {game.phase === 'ready' ? (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
                <span>Stand back so your arms are in frame.</span>
                <button
                  type="button"
                  onClick={startRound}
                  className="shrink-0 rounded-full bg-[rgba(79,184,178,0.9)] px-4 py-1.5 font-bold text-[#06343a] transition hover:bg-white"
                >
                  Begin
                </button>
              </div>
            ) : null}

            {/* Countdown bar — fills the top edge, drains as time runs out. */}
            {isTimed ? (
              <div className="absolute inset-x-0 top-0 h-1.5 bg-black/30">
                <div
                  className={`h-full transition-[width] duration-100 ease-linear ${
                    timerLow ? 'bg-rose-400' : 'bg-[var(--lagoon)]'
                  }`}
                  style={{ width: `${timerFraction * 100}%` }}
                />
              </div>
            ) : null}

            {/* Big flashy transition cue. Only shown in idle-mode beats, so it
                never blocks the live preview while you're being detected. */}
            {cue ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
                <div
                  key={`${game.phase}-${game.active?.uid ?? 'x'}`}
                  className={`cue flex flex-col items-center gap-2 rounded-3xl px-6 py-5 text-center text-white shadow-2xl backdrop-blur ${
                    cue.tone === 'good'
                      ? 'bg-emerald-500/80'
                      : cue.tone === 'bad'
                        ? 'bg-rose-500/80'
                        : 'bg-[rgba(50,143,151,0.82)]'
                  }`}
                >
                  {cue.shapeId ? (
                    <div className="scale-150">
                      <div className="cue-throb">
                        <ShapePreview shapeId={cue.shapeId} />
                      </div>
                    </div>
                  ) : null}
                  <p className="display-title cue-throb text-3xl font-bold leading-none sm:text-5xl">
                    {cue.title}
                  </p>
                  {cue.subtitle ? (
                    <p className="text-sm font-semibold opacity-95 sm:text-base">
                      {cue.subtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {game.phase === 'gameover' ? (
              <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center text-white">
                <div>
                  <p className="display-title text-3xl font-bold">Game over</p>
                  <p className="mt-1 text-sm opacity-90">
                    Score {game.score} · {game.lines} lines
                  </p>
                  <button
                    type="button"
                    onClick={handlePlayAgain}
                    className="mt-4 rounded-full bg-[rgba(79,184,178,0.9)] px-5 py-2 text-sm font-bold text-[#06343a] transition hover:bg-white"
                  >
                    Play again
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Board */}
          <section
            aria-label="Game board"
            className="rounded-2xl border border-[var(--chip-line)] bg-[var(--surface)] p-3"
          >
            <div
              className="mx-auto w-fit overflow-auto rounded-xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface-strong)_80%,var(--sand))] p-2"
              role="img"
              aria-label={`16 by 16 board. Score ${game.score}, ${game.lines} lines cleared.`}
            >
              <div
                className="game-board-stage grid w-fit rounded-md border border-[rgba(23,58,64,0.12)] [grid-template-columns:repeat(16,var(--cell-size))] [grid-template-rows:repeat(16,var(--cell-size))]"
                style={
                  {
                    '--cell-size': 'clamp(1rem, 5vw, 3rem)',
                  } as CSSProperties
                }
              >
                {BOARD_INDEX.map((_, index) => {
                  const value = game.board[index]
                  const gradient = value ? SHAPE_VISUALS[value].gradient : null
                  return (
                    <span
                      key={index}
                      aria-hidden="true"
                      className="h-[var(--cell-size)] w-[var(--cell-size)] border-[2px] border-[rgba(23,58,64,0.22)]"
                      style={
                        gradient
                          ? {
                              backgroundImage: `linear-gradient(to bottom left, ${gradient.highlight} 0%, ${gradient.base} 56%, ${gradient.shadow} 100%)`,
                              boxShadow:
                                'inset 0 1px 0 rgba(255, 255, 255, 0.34)',
                            }
                          : {
                              background:
                                'color-mix(in oklab, var(--surface-strong) 86%, white)',
                            }
                      }
                    />
                  )
                })}
                {game.active &&
                (game.phase === 'prep' ||
                  game.phase === 'making' ||
                  game.phase === 'matched' ||
                  game.phase === 'pointing' ||
                  game.phase === 'moving') ? (
                  <GamePiece key={game.active.uid} piece={game.active} />
                ) : null}
              </div>
            </div>
          </section>

          {/* Status + legend */}
          <aside
            aria-label="Status"
            className="flex flex-col gap-3 rounded-2xl border border-[var(--chip-line)] bg-[var(--surface)] p-3"
          >
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Score" value={game.score} />
              <StatCard label="Lines" value={game.lines} />
              <StatCard label="Timer" value={timerLabel} />
            </div>

            <article className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-3">
              <p className="island-kicker mb-1">
                {game.phase === 'pointing' || game.phase === 'matched'
                  ? 'Now'
                  : 'Target'}
              </p>
              {game.phase === 'pointing' || game.phase === 'matched' ? (
                <p className="m-0 text-base font-semibold text-[var(--lagoon-deep)]">
                  Point an arm at a corner.
                </p>
              ) : targetVisual &&
                (game.phase === 'making' || game.phase === 'prep') ? (
                <div className="flex items-center gap-2">
                  <ShapePreview shapeId={target!} />
                  <div>
                    <p className="m-0 text-base font-semibold text-[var(--sea-ink)]">
                      {targetVisual.label}
                    </p>
                    <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                      {targetVisual.pose}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                  {game.phase === 'idle'
                    ? 'Enable the camera to start.'
                    : game.phase === 'ready'
                      ? 'Press Begin to spawn a shape.'
                      : 'Get ready…'}
                </p>
              )}
            </article>

            <div>
              <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
                Shapes
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {SHAPE_IDS.map((id) => (
                  <article
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] p-2"
                  >
                    <ShapePreview shapeId={id} />
                    <p className="m-0 text-sm font-semibold leading-tight text-[var(--sea-ink)]">
                      {SHAPE_VISUALS[id].label}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-2 text-center">
      <p className="m-0 text-xs tracking-[0.08em] text-[var(--sea-ink-soft)] uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--sea-ink)]">
        {value}
      </p>
    </article>
  )
}

// Small fixed 4x4 preview of a shape's cells, using its gradient.
function ShapePreview({ shapeId }: { shapeId: ShapeId }) {
  const cells = SHAPES[shapeId]
  const { gradient } = SHAPE_VISUALS[shapeId]
  return (
    <div aria-hidden="true" className="grid grid-cols-4 grid-rows-4 gap-1">
      {Array.from({ length: 16 }).map((_, i) => {
        const x = i % 4
        const y = Math.floor(i / 4)
        const occupied = cells.some(([cx, cy]) => cx === x && cy === y)
        return (
          <span
            key={i}
            className="h-5 w-5 rounded-[2px]"
            style={
              occupied
                ? {
                    backgroundImage: `linear-gradient(to bottom left, ${gradient.highlight} 0%, ${gradient.base} 55%, ${gradient.shadow} 100%)`,
                    border: '1px solid rgba(23, 58, 64, 0.28)',
                  }
                : { background: 'transparent' }
            }
          />
        )
      })}
    </div>
  )
}

// Active/sliding piece overlay. The CSS transition on `.game-piece` animates the
// slide whenever `origin` changes while the element (keyed by uid) persists.
function GamePiece({ piece }: { piece: ActivePiece }) {
  const cells = SHAPES[piece.shapeId]
  const { width, height } = shapeBounds(cells)
  const { gradient } = SHAPE_VISUALS[piece.shapeId]
  const style = {
    '--piece-x': piece.origin.x,
    '--piece-y': piece.origin.y,
    '--piece-highlight': gradient.highlight,
    '--piece-base': gradient.base,
    '--piece-shadow': gradient.shadow,
    gridTemplateColumns: `repeat(${width}, var(--cell-size))`,
    gridTemplateRows: `repeat(${height}, var(--cell-size))`,
  } as CSSProperties

  return (
    <div className="game-piece game-piece--active" style={style} aria-hidden="true">
      {cells.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          className="game-piece__cell"
          style={{ gridColumn: x + 1, gridRow: y + 1 }}
        />
      ))}
    </div>
  )
}
