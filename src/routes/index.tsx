import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useHotkeys } from '@tanstack/react-hotkeys'
import { createFileRoute } from '@tanstack/react-router'

type Coordinate = [number, number]
type ShapeId = 'SQUARE' | 'L_0' | 'L_90' | 'L_180' | 'L_270' | 'LINE_V' | 'LINE_H'
type Corner = 'TL' | 'TR' | 'BL' | 'BR'
type GamePhase =
  | 'boot'
  | 'responding'
  | 'moving'
  | 'exploding'
  | 'between-rounds'

type BoardPosition = {
  x: number
  y: number
}

type ShapeDefinition = {
  id: ShapeId
  label: string
  cells: readonly Coordinate[]
  gradient: {
    highlight: string
    base: string
    shadow: string
  }
}

type PieceInstance = {
  uid: number
  shape: ShapeDefinition
  origin: BoardPosition
  corner?: Corner
}

type PlacedPiece = PieceInstance & {
  corner: Corner
}

type GameState = {
  phase: GamePhase
  roundId: number
  nextUid: number
  active: PieceInstance | null
  placed: PlacedPiece[]
  deadlineAt: number | null
  remainingMs: number
  announcement: string
}

const BOARD_SIZE = 16
const RESPONSE_MS = 4_000
const MOVE_MS = 360
const EXPLOSION_MS = 650
const REDUCED_MOVE_MS = 60
const REDUCED_EXPLOSION_MS = 160
const SETTLE_MS = 750
const TICK_MS = 100

const CORNER_LABELS: Record<Corner, string> = {
  TL: 'upper-left',
  TR: 'upper-right',
  BL: 'lower-left',
  BR: 'lower-right',
}

const HOTKEYS: readonly {
  hotkey: 'Q' | 'W' | 'A' | 'S'
  corner: Corner
  label: string
}[] = [
  { hotkey: 'Q', corner: 'TL', label: 'upper-left' },
  { hotkey: 'W', corner: 'TR', label: 'upper-right' },
  { hotkey: 'A', corner: 'BL', label: 'lower-left' },
  { hotkey: 'S', corner: 'BR', label: 'lower-right' },
]

const PIECES: readonly ShapeDefinition[] = [
  {
    id: 'SQUARE',
    label: 'Square',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    gradient: {
      highlight: '#ffe9a3',
      base: '#efbf3c',
      shadow: '#c68f09',
    },
  },
  {
    id: 'L_0',
    label: 'Arm Low Right',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    gradient: {
      highlight: '#a6e3ff',
      base: '#3a9ed8',
      shadow: '#1f67a5',
    },
  },
  {
    id: 'L_90',
    label: 'Arm Low Left',
    cells: [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
    gradient: {
      highlight: '#ffc2c5',
      base: '#eb6c72',
      shadow: '#ab2f35',
    },
  },
  {
    id: 'L_180',
    label: 'Arm High Left',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    gradient: {
      highlight: '#c8f0c6',
      base: '#6bcf72',
      shadow: '#2e9f47',
    },
  },
  {
    id: 'L_270',
    label: 'Arm High Right',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 2],
    ],
    gradient: {
      highlight: '#ffdab0',
      base: '#f49c45',
      shadow: '#bd5f12',
    },
  },
  {
    id: 'LINE_V',
    label: 'Stand Tall',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    gradient: {
      highlight: '#cfb9ff',
      base: '#8d73e0',
      shadow: '#563ca0',
    },
  },
  {
    id: 'LINE_H',
    label: 'Arms Out',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    gradient: {
      highlight: '#ffccf0',
      base: '#ed74c5',
      shadow: '#ad2d85',
    },
  },
] as const

const BOARD_INDEX = Array.from({ length: BOARD_SIZE * BOARD_SIZE })

function hasCell(shape: ShapeDefinition, x: number, y: number) {
  return shape.cells.some((cell) => cell[0] === x && cell[1] === y)
}

function getShapeBounds(shape: ShapeDefinition) {
  const maxX = Math.max(...shape.cells.map(([x]) => x))
  const maxY = Math.max(...shape.cells.map(([, y]) => y))

  return {
    width: maxX + 1,
    height: maxY + 1,
  }
}

function getCenteredOrigin(shape: ShapeDefinition): BoardPosition {
  const { width, height } = getShapeBounds(shape)

  return {
    x: Math.floor((BOARD_SIZE - width) / 2),
    y: Math.floor((BOARD_SIZE - height) / 2),
  }
}

function getCornerOrigin(shape: ShapeDefinition, corner: Corner): BoardPosition {
  const { width, height } = getShapeBounds(shape)

  switch (corner) {
    case 'TL':
      return { x: 0, y: 0 }
    case 'TR':
      return { x: BOARD_SIZE - width, y: 0 }
    case 'BL':
      return { x: 0, y: BOARD_SIZE - height }
    case 'BR':
      return { x: BOARD_SIZE - width, y: BOARD_SIZE - height }
  }
}

function getCellKey(x: number, y: number) {
  return `${x},${y}`
}

function getOccupiedCells(placed: readonly PlacedPiece[]) {
  const occupied = new Set<string>()

  placed.forEach((piece) => {
    piece.shape.cells.forEach(([cellX, cellY]) => {
      occupied.add(getCellKey(piece.origin.x + cellX, piece.origin.y + cellY))
    })
  })

  return occupied
}

function shapeOverlapsOccupiedCells(
  shape: ShapeDefinition,
  origin: BoardPosition,
  occupied: ReadonlySet<string>,
) {
  return shape.cells.some(([cellX, cellY]) =>
    occupied.has(getCellKey(origin.x + cellX, origin.y + cellY)),
  )
}

function getCornerOrderedOrigins(
  shape: ShapeDefinition,
  corner: Corner,
): BoardPosition[] {
  const { width, height } = getShapeBounds(shape)
  const maxX = BOARD_SIZE - width
  const maxY = BOARD_SIZE - height
  const xOrigins = Array.from({ length: maxX + 1 }, (_, x) => x)
  const yOrigins = Array.from({ length: maxY + 1 }, (_, y) => y)

  if (corner === 'TR' || corner === 'BR') {
    xOrigins.reverse()
  }

  if (corner === 'BL' || corner === 'BR') {
    yOrigins.reverse()
  }

  return yOrigins.flatMap((y) => xOrigins.map((x) => ({ x, y })))
}

function getStackedCornerOrigin(
  shape: ShapeDefinition,
  corner: Corner,
  placed: readonly PlacedPiece[],
): BoardPosition {
  const occupied = getOccupiedCells(placed)
  const origins = getCornerOrderedOrigins(shape, corner)
  const availableOrigin = origins.find(
    (origin) => !shapeOverlapsOccupiedCells(shape, origin, occupied),
  )

  return availableOrigin ?? origins[0] ?? getCornerOrigin(shape, corner)
}

function pickRandomPiece() {
  return PIECES[Math.floor(Math.random() * PIECES.length)]
}

function createRoundState(
  previous: GameState,
  shape: ShapeDefinition,
  now: number,
): GameState {
  return {
    ...previous,
    phase: 'responding',
    roundId: previous.roundId + 1,
    nextUid: previous.nextUid + 1,
    active: {
      uid: previous.nextUid,
      shape,
      origin: getCenteredOrigin(shape),
    },
    deadlineAt: now + RESPONSE_MS,
    remainingMs: RESPONSE_MS,
    announcement: `${shape.label} is centered. Press Q for upper-left, W for upper-right, A for lower-left, or S for lower-right.`,
  }
}

function formatRemaining(ms: number) {
  return `${Math.max(0, ms / 1_000).toFixed(1)}s`
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches)

    updateReducedMotion()
    mediaQuery.addEventListener('change', updateReducedMotion)

    return () => mediaQuery.removeEventListener('change', updateReducedMotion)
  }, [])

  return reducedMotion
}

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const reducedMotion = useReducedMotion()
  const moveDuration = reducedMotion ? REDUCED_MOVE_MS : MOVE_MS
  const explosionDuration = reducedMotion ? REDUCED_EXPLOSION_MS : EXPLOSION_MS
  const hasStartedRef = useRef(false)
  const [game, setGame] = useState<GameState>(() => ({
    phase: 'boot',
    roundId: 0,
    nextUid: 1,
    active: null,
    placed: [],
    deadlineAt: null,
    remainingMs: RESPONSE_MS,
    announcement: 'Game is getting ready. Use Q, W, A, and S to send shapes to board corners.',
  }))

  const startRound = useCallback(() => {
    const shape = pickRandomPiece()
    const now = performance.now()

    setGame((previous) => createRoundState(previous, shape, now))
  }, [])

  const triggerTimeout = useCallback((roundId: number) => {
    setGame((current) => {
      if (
        current.phase !== 'responding' ||
        current.roundId !== roundId ||
        current.active === null
      ) {
        return current
      }

      return {
        ...current,
        phase: 'exploding',
        deadlineAt: null,
        remainingMs: 0,
        announcement: `Time expired. ${current.active.shape.label} bursts away.`,
      }
    })
  }, [])

  const handleCorner = useCallback((corner: Corner) => {
    const now = performance.now()

    setGame((current) => {
      if (
        current.phase !== 'responding' ||
        current.active === null ||
        current.deadlineAt === null
      ) {
        return current
      }

      if (now >= current.deadlineAt) {
        return {
          ...current,
          phase: 'exploding',
          deadlineAt: null,
          remainingMs: 0,
          announcement: `Time expired. ${current.active.shape.label} bursts away.`,
        }
      }

      return {
        ...current,
        phase: 'moving',
        active: {
          ...current.active,
          origin: getStackedCornerOrigin(
            current.active.shape,
            corner,
            current.placed,
          ),
          corner,
        },
        deadlineAt: null,
        remainingMs: 0,
        announcement: `${current.active.shape.label} is moving to the ${CORNER_LABELS[corner]} corner.`,
      }
    })
  }, [])

  useHotkeys(
    HOTKEYS.map(({ hotkey, corner, label }) => ({
      hotkey,
      callback: (event: KeyboardEvent) => {
        if (event.repeat) {
          return
        }

        handleCorner(corner)
      },
      options: {
        meta: {
          name: `Move shape ${label}`,
          description: `Send the active shape to the ${label} corner.`,
        },
      },
    })),
    {
      enabled: game.phase === 'responding',
      preventDefault: true,
    },
  )

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true
    startRound()
  }, [startRound])

  useEffect(() => {
    if (game.phase !== 'responding' || game.deadlineAt === null) {
      return
    }

    const roundId = game.roundId
    const updateRemaining = () => {
      const remainingMs = Math.max(0, game.deadlineAt! - performance.now())

      setGame((current) => {
        if (current.phase !== 'responding' || current.roundId !== roundId) {
          return current
        }

        return {
          ...current,
          remainingMs,
        }
      })
    }

    updateRemaining()
    const intervalId = window.setInterval(updateRemaining, TICK_MS)
    const timeoutId = window.setTimeout(
      () => triggerTimeout(roundId),
      Math.max(0, game.deadlineAt - performance.now()),
    )

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [game.deadlineAt, game.phase, game.roundId, triggerTimeout])

  useEffect(() => {
    if (game.phase !== 'moving' || game.active?.corner === undefined) {
      return
    }

    const roundId = game.roundId
    const timeoutId = window.setTimeout(() => {
      setGame((current) => {
        if (
          current.phase !== 'moving' ||
          current.roundId !== roundId ||
          current.active?.corner === undefined
        ) {
          return current
        }

        const placedPiece: PlacedPiece = {
          ...current.active,
          corner: current.active.corner,
        }

        return {
          ...current,
          phase: 'between-rounds',
          active: null,
          placed: [...current.placed, placedPiece],
          announcement: `${current.active.shape.label} placed in the ${CORNER_LABELS[current.active.corner]} corner. Next shape soon.`,
        }
      })
    }, moveDuration)

    return () => window.clearTimeout(timeoutId)
  }, [game.active?.corner, game.phase, game.roundId, moveDuration])

  useEffect(() => {
    if (game.phase !== 'between-rounds') {
      return
    }

    const timeoutId = window.setTimeout(startRound, SETTLE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [game.phase, startRound])

  useEffect(() => {
    if (game.phase !== 'exploding') {
      return
    }

    const roundId = game.roundId
    const timeoutId = window.setTimeout(() => {
      const shape = pickRandomPiece()
      const now = performance.now()

      setGame((current) => {
        if (current.phase !== 'exploding' || current.roundId !== roundId) {
          return current
        }

        return createRoundState(
          {
            ...current,
            active: null,
            deadlineAt: null,
            remainingMs: RESPONSE_MS,
          },
          shape,
          now,
        )
      })
    }, explosionDuration)

    return () => window.clearTimeout(timeoutId)
  }, [explosionDuration, game.phase, game.roundId])

  const activeShapeLabel = game.active?.shape.label ?? 'No active shape'
  const timerLabel =
    game.phase === 'responding' ? formatRemaining(game.remainingMs) : '—'

  return (
    <main className="page-wrap px-4 py-5 sm:py-8">
      <section className="island-shell rounded-[1.5rem] p-4 sm:p-6">
        <h1 className="display-title mb-4 whitespace-nowrap text-center text-4xl leading-none font-bold text-[var(--sea-ink)] sm:text-6xl">
          Shape Up!
        </h1>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)]">
          <section
            aria-label="Keyboard response game board"
            className="rounded-2xl border border-[var(--chip-line)] bg-[var(--surface)] p-4"
          >
            <p className="mb-3 text-sm font-medium text-[var(--sea-ink-soft)]">
              Send the centered shape to a corner before the 4 second timer ends:{' '}
              <kbd className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-1.5 py-0.5 font-semibold text-[var(--sea-ink)]">
                Q
              </kbd>{' '}
              upper-left ·{' '}
              <kbd className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-1.5 py-0.5 font-semibold text-[var(--sea-ink)]">
                W
              </kbd>{' '}
              upper-right ·{' '}
              <kbd className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-1.5 py-0.5 font-semibold text-[var(--sea-ink)]">
                A
              </kbd>{' '}
              lower-left ·{' '}
              <kbd className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-1.5 py-0.5 font-semibold text-[var(--sea-ink)]">
                S
              </kbd>{' '}
              lower-right.
            </p>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {game.announcement}
            </p>

            <div
              className="mx-auto w-fit overflow-auto rounded-xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--surface-strong)_80%,var(--sand))] p-2"
              aria-label={`16 by 16 game board. Active shape: ${activeShapeLabel}. ${game.placed.length} shapes are placed.`}
              role="img"
            >
              <div
                className="game-board-stage grid w-fit rounded-md border border-[rgba(23,58,64,0.12)] [grid-template-columns:repeat(16,var(--cell-size))] [grid-template-rows:repeat(16,var(--cell-size))]"
                style={
                  {
                    '--cell-size': 'clamp(0.85rem, 4vw, 1.6rem)',
                  } as CSSProperties
                }
              >
                {BOARD_INDEX.map((_, index) => {
                  return (
                    <span
                      key={index}
                      aria-hidden="true"
                      className="h-[var(--cell-size)] w-[var(--cell-size)] border-[2px] border-[rgba(23,58,64,0.28)] bg-[color-mix(in_oklab,var(--surface-strong)_86%,white)]"
                    />
                  )
                })}
                {game.placed.map((piece) => (
                  <GamePiece key={piece.uid} piece={piece} state="placed" />
                ))}
                {game.active ? (
                  <GamePiece
                    key={game.active.uid}
                    piece={game.active}
                    state={game.phase === 'exploding' ? 'exploding' : 'active'}
                  />
                ) : null}
              </div>
            </div>
          </section>

          <aside
            aria-label="Allowed piece catalog"
            className="rounded-2xl border border-[var(--chip-line)] bg-[var(--surface)] p-3"
          >
            <article className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-3">
              <p className="m-0 text-xs tracking-[0.08em] text-[var(--sea-ink-soft)] uppercase">
                Timer
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--sea-ink)]">
                {timerLabel}
              </p>
            </article>

            <h2 className="mb-3 text-sm font-semibold text-[var(--sea-ink)]">
              Pieces
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {PIECES.map((shape) => (
                <article
                  key={shape.id}
                  className="grid grid-cols-[4.75rem_1fr] items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--chip-bg)] p-2"
                >
                  <div
                    aria-hidden="true"
                    className="grid w-fit rounded-md bg-transparent"
                  >
                    <div className="grid grid-cols-4 grid-rows-4 gap-0.5">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const x = i % 4
                        const y = Math.floor(i / 4)
                        const occupied = hasCell(shape, x, y)
                        return (
                          <span
                            key={`${shape.id}-${x}-${y}`}
                            className="h-3.5 w-3.5 rounded-[2px] sm:h-4 sm:w-4"
                            style={
                              occupied
                                ? {
                                    backgroundImage: `linear-gradient(to bottom left, ${shape.gradient.highlight} 0%, ${shape.gradient.base} 55%, ${shape.gradient.shadow} 100%)`,
                                    border: '1px solid rgba(23, 58, 64, 0.28)',
                                    boxShadow:
                                      'inset 0 1px 0 rgba(255, 255, 255, 0.34)',
                                  }
                                : {
                                    background: 'transparent',
                                    border: '1px solid transparent',
                                  }
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                  <p className="m-0 text-xs font-semibold text-[var(--sea-ink)]">
                    {shape.label}
                  </p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function GamePiece({
  piece,
  state,
}: {
  piece: PieceInstance
  state: 'active' | 'placed' | 'exploding'
}) {
  const bounds = getShapeBounds(piece.shape)
  const className = ['game-piece', `game-piece--${state}`].join(' ')
  const style = {
    '--piece-x': piece.origin.x,
    '--piece-y': piece.origin.y,
    '--piece-highlight': piece.shape.gradient.highlight,
    '--piece-base': piece.shape.gradient.base,
    '--piece-shadow': piece.shape.gradient.shadow,
    gridTemplateColumns: `repeat(${bounds.width}, var(--cell-size))`,
    gridTemplateRows: `repeat(${bounds.height}, var(--cell-size))`,
  } as CSSProperties

  return (
    <div className={className} style={style} aria-hidden="true">
      {piece.shape.cells.map(([x, y]) => (
        <span
          key={`${piece.uid}-${x}-${y}`}
          className="game-piece__cell"
          style={{ gridColumn: x + 1, gridRow: y + 1 }}
        />
      ))}
    </div>
  )
}
