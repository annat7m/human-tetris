import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import type {
  Corner,
  Mode,
  RecognitionProps,
  ShapeId,
} from '#/lib/recognition-types'
import type { PointingDebug } from '#/lib/pointing-recognition'

export const Route = createFileRoute('/test')({ component: TestPage })

// onShapeDetected + onPoint are the real Engine/Recognition contract; onDebug,
// className and resetSignal are harness-only extras, so widen the prop type.
type RecognitionComponentProps = RecognitionProps & {
  onDebug?: (debug: PointingDebug) => void
  className?: string
  resetSignal?: number
}

// After a point locks, re-arm automatically so you can keep pointing.
const AUTO_REARM_MS = 1200

const PHASES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'making', label: 'Shape', hint: 'form a body shape' },
  { mode: 'pointing', label: 'Point', hint: 'point at a corner' },
  { mode: 'idle', label: 'Idle', hint: 'recognition does nothing' },
]

const CORNERS: Corner[] = ['TL', 'TR', 'BL', 'BR']

function TestPage() {
  const [mode, setMode] = useState<Mode>('making')
  const [cameraOn, setCameraOn] = useState(false)

  // Pointing-phase state.
  const [debug, setDebug] = useState<PointingDebug | null>(null)
  const [lastPoint, setLastPoint] = useState<Corner | null>(null)
  const [changeKey, setChangeKey] = useState(0)
  const [fireKey, setFireKey] = useState(0)
  const [resetSignal, setResetSignal] = useState(0)
  const [autoRearm, setAutoRearm] = useState(true)
  const prevCandidateRef = useRef<Corner | null>(null)

  // Making-phase state: the onShapeDetected log.
  const [log, setLog] = useState<{ shape: ShapeId; mode: Mode }[]>([])

  // Recognition pulls in browser-only MediaPipe + getUserMedia, so load it
  // lazily on the client to keep SSR happy.
  const [Recognition, setRecognition] =
    useState<ComponentType<RecognitionComponentProps> | null>(null)

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

  // Each phase starts fresh — mirrors the detector's per-phase reset.
  useEffect(() => {
    setDebug(null)
    setLastPoint(null)
    prevCandidateRef.current = null
  }, [mode, cameraOn])

  const handleDebug = useCallback((d: PointingDebug) => {
    setDebug(d)
    if (d.candidate !== prevCandidateRef.current) {
      prevCandidateRef.current = d.candidate
      setChangeKey((k) => k + 1)
    }
  }, [])

  const handlePoint = useCallback((corner: Corner) => {
    setLastPoint(corner)
    setFireKey((k) => k + 1)
  }, [])

  // Re-arm the detector so the next point can fire without changing phase.
  const handleReset = useCallback(() => {
    setLastPoint(null)
    prevCandidateRef.current = null
    setResetSignal((k) => k + 1)
  }, [])

  // After a lock, optionally re-arm on a timer so testing flows hands-free.
  useEffect(() => {
    if (!autoRearm || !lastPoint) return
    const id = setTimeout(handleReset, AUTO_REARM_MS)
    return () => clearTimeout(id)
  }, [autoRearm, lastPoint, fireKey, handleReset])

  const candidate = debug?.candidate ?? null

  return (
    <main className="fixed inset-0 z-[55] flex flex-col gap-2 overflow-hidden bg-[var(--bg-base)] p-2 sm:p-3">
      {/* Compact top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="island-kicker">Recognition Test</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {PHASES.map((p) => (
            <button
              key={p.mode}
              type="button"
              title={p.hint}
              onClick={() => setMode(p.mode)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                mode === p.mode
                  ? 'border-[rgba(50,143,151,0.5)] bg-[rgba(79,184,178,0.24)] text-[var(--lagoon-deep)]'
                  : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleReset}
            disabled={mode !== 'pointing'}
            className="rounded-full border border-[rgba(50,143,151,0.5)] bg-[rgba(79,184,178,0.24)] px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.38)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Point again
          </button>
          <button
            type="button"
            onClick={() => setAutoRearm((v) => !v)}
            disabled={mode !== 'pointing'}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              autoRearm
                ? 'border-[rgba(50,143,151,0.5)] bg-[rgba(79,184,178,0.24)] text-[var(--lagoon-deep)]'
                : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
            }`}
          >
            Auto {autoRearm ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={() => setCameraOn((v) => !v)}
            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-3 py-1 text-xs font-semibold text-[var(--sea-ink)] transition hover:border-[rgba(23,58,64,0.35)]"
          >
            {cameraOn ? 'Stop' : 'Enable camera'}
          </button>
        </div>
      </div>

      {/* Everything fits here — camera left, readout/grid/debug right */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-2 lg:grid-cols-2 lg:grid-rows-1">
        {/* Camera */}
        <div className="min-h-0">
          {cameraOn && Recognition ? (
            <Recognition
              mode={mode}
              onPoint={handlePoint}
              onDebug={handleDebug}
              onShapeDetected={(shape) => {
                console.log('[test] onShapeDetected', shape)
                setLog((l) => [{ shape, mode }, ...l].slice(0, 8))
              }}
              resetSignal={resetSignal}
              className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
            />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--chip-bg)] text-sm text-[var(--sea-ink-soft)]">
              {cameraOn ? 'Loading…' : 'Camera off — click “Enable camera”.'}
            </div>
          )}
        </div>

        {/* Indicator column */}
        <div className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-2">
          <BigReadout
            mode={mode}
            candidate={candidate}
            lastPoint={lastPoint}
            changeKey={changeKey}
            fireKey={fireKey}
          />

          {mode === 'pointing' ? (
            <CornerGrid
              charge={debug?.charge ?? null}
              candidate={candidate}
              lastPoint={lastPoint}
              fireKey={fireKey}
            />
          ) : mode === 'making' ? (
            <ShapeLog log={log} />
          ) : (
            <div className="grid min-h-0 place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--chip-bg)] text-sm text-[var(--sea-ink-soft)]">
              Switch to <code className="mx-1">making</code> or{' '}
              <code className="mx-1">pointing</code> to test
            </div>
          )}

          <DebugBar mode={mode} debug={debug} lastPoint={lastPoint} />
        </div>
      </div>
    </main>
  )
}

function ShapeLog({ log }: { log: { shape: ShapeId; mode: Mode }[] }) {
  return (
    <div className="min-h-0 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
      <p className="island-kicker mb-2">onShapeDetected log</p>
      {log.length === 0 ? (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          No shapes detected yet. In <code>making</code> mode, hold a body pose
          steady for ~half a second.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0 font-mono text-sm text-[var(--sea-ink)]">
          {log.map((entry, i) => (
            <li key={i}>
              <b className="text-[var(--lagoon-deep)]">{entry.shape}</b>{' '}
              <span className="opacity-60">({entry.mode})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BigReadout({
  mode,
  candidate,
  lastPoint,
  changeKey,
  fireKey,
}: {
  mode: Mode
  candidate: Corner | null
  lastPoint: Corner | null
  changeKey: number
  fireKey: number
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-5 py-3">
      <div className="min-w-0">
        <p className="island-kicker">Pointing at</p>
        <div
          key={`cand-${changeKey}`}
          className="flash-pop display-title text-[clamp(3rem,9vw,6rem)] font-bold leading-none text-[var(--lagoon-deep)]"
        >
          {mode === 'pointing' ? (candidate ?? '—') : '—'}
        </div>
      </div>
      <div
        key={`fire-${fireKey}`}
        className={`shrink-0 rounded-full px-4 py-2 text-center text-sm font-bold sm:text-lg ${
          lastPoint
            ? 'flash-fire bg-[rgba(79,184,178,0.22)] text-[var(--lagoon-deep)]'
            : 'text-[var(--sea-ink-soft)]'
        }`}
      >
        {lastPoint ? `LOCKED ${lastPoint}` : 'hold…'}
      </div>
    </div>
  )
}

function CornerGrid({
  charge,
  candidate,
  lastPoint,
  fireKey,
}: {
  charge: Record<Corner, number> | null
  candidate: Corner | null
  lastPoint: Corner | null
  fireKey: number
}) {
  return (
    <div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-2">
      {CORNERS.map((corner) => {
        const value = charge?.[corner] ?? 0
        const isCandidate = candidate === corner
        const isFired = lastPoint === corner
        return (
          <div
            key={isFired ? `${corner}-${fireKey}` : corner}
            className={`relative grid h-full w-full place-items-center overflow-hidden rounded-2xl border-2 ${
              isFired
                ? 'flash-fire border-[var(--lagoon-deep)]'
                : isCandidate
                  ? 'border-[var(--lagoon-deep)]'
                  : 'border-[var(--line)]'
            } bg-[var(--chip-bg)]`}
          >
            <div
              className="absolute inset-x-0 bottom-0 bg-[rgba(79,184,178,0.34)] transition-[height] duration-100"
              style={{ height: `${Math.round(value * 100)}%` }}
            />
            <div className="relative z-10 text-center leading-none">
              <div className="display-title text-[clamp(1.5rem,5vw,3.5rem)] font-bold text-[var(--sea-ink)]">
                {corner}
              </div>
              <div className="mt-1 text-xs font-semibold tabular-nums text-[var(--sea-ink-soft)]">
                {Math.round(value * 100)}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DebugBar({
  mode,
  debug,
  lastPoint,
}: {
  mode: Mode
  debug: PointingDebug | null
  lastPoint: Corner | null
}) {
  const reach = debug?.reach
  const fmtExt = (ext: number | null | undefined) => {
    if (ext === null || ext === undefined) return '—'
    const flag = reach !== undefined && ext > reach ? '✓' : ''
    return `${ext.toFixed(2)}${flag}`
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2 font-mono text-[11px] text-[var(--sea-ink-soft)] sm:text-xs">
      <span>mode={mode}</span>
      <span className={debug?.bodyVisible ? 'text-[var(--lagoon-deep)]' : ''}>
        body={debug ? (debug.bodyVisible ? 'yes' : 'no') : '—'}
      </span>
      <span>arm={debug?.activeArm ?? 'none'}</span>
      <span>
        L={fmtExt(debug?.extension.left)} R={fmtExt(debug?.extension.right)}
      </span>
      <span>reach={reach !== undefined ? reach.toFixed(2) : '—'}</span>
      <span>cand={debug?.candidate ?? 'none'}</span>
      <span>fired={lastPoint ?? 'none'}</span>
      <span>T={debug ? `${debug.holdSeconds.toFixed(2)}s` : '—'}</span>
    </div>
  )
}
