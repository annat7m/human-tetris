import { createFileRoute } from '@tanstack/react-router'

type Coordinate = [number, number]

type ShapeDefinition = {
  id: 'SQUARE' | 'L_0' | 'L_90' | 'L_180' | 'L_270' | 'LINE_V' | 'LINE_H'
  label: string
  cells: readonly Coordinate[]
  gradient: {
    highlight: string
    base: string
    shadow: string
  }
}

const BOARD_SIZE = 16

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

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="page-wrap px-4 py-5 sm:py-8">
      <section className="island-shell rounded-[1.5rem] p-4 sm:p-6">
        <h1 className="display-title mb-4 whitespace-nowrap text-center text-4xl leading-none font-bold text-[var(--sea-ink)] sm:text-6xl">
          Shape Up!
        </h1>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)]">
          <section
            aria-label="Game board preview"
            className="rounded-2xl border border-[var(--chip-line)] bg-[var(--surface)] p-4"
          >
            <div className="mb-4 grid grid-cols-2 gap-3">
              <article className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-3">
                <p className="m-0 text-xs uppercase tracking-[0.08em] text-[var(--sea-ink-soft)]">
                  Score
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--sea-ink)]">
                  0000
                </p>
              </article>
              <article className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] p-3">
                <p className="m-0 text-xs uppercase tracking-[0.08em] text-[var(--sea-ink-soft)]">
                  Timer
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--sea-ink)]">
                  00:00
                </p>
              </article>
            </div>

            <div
              className="mx-auto w-fit overflow-auto rounded-xl border border-[var(--line)] bg-[color-mix(in oklab, var(--surface-strong) 80%, var(--sand))] p-2"
              aria-label="Empty 16 by 16 game board"
              role="img"
            >
              <div
                className="grid w-fit rounded-md border border-[rgba(23,58,64,0.12)] [grid-template-columns:repeat(16,var(--cell-size))] [grid-template-rows:repeat(16,var(--cell-size))]"
                style={
                  {
                    '--cell-size': 'clamp(0.85rem, 4vw, 1.6rem)',
                  } as React.CSSProperties
                }
              >
                {BOARD_INDEX.map((_, index) => {
                  return (
                    <span
                      key={index}
                      aria-label="Empty board cell"
                      className="h-[var(--cell-size)] w-[var(--cell-size)] border-[2px] border-[rgba(23,58,64,0.28)] bg-[color-mix(in oklab, var(--surface-strong) 86%, white)]"
                    />
                  )
                })}
              </div>
            </div>
          </section>

          <aside
            aria-label="Allowed piece catalog"
            className="rounded-2xl border border-[var(--chip-line)] bg-[var(--surface)] p-3"
          >
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
