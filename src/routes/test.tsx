import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import type { Mode, RecognitionProps } from '#/lib/recognition-types'

export const Route = createFileRoute('/test')({ component: TestPage })

const PHASES: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'making', label: 'Shape phase', hint: 'form a body shape' },
  { mode: 'pointing', label: 'Point phase', hint: 'point at a corner' },
  { mode: 'idle', label: 'Idle', hint: 'recognition does nothing' },
]

function TestPage() {
  const [mode, setMode] = useState<Mode>('making')
  const [cameraOn, setCameraOn] = useState(false)
  // Recognition pulls in browser-only MediaPipe + getUserMedia, so load it
  // lazily on the client to keep SSR happy.
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

  return (
    <main className="page-wrap px-4 py-10">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Recognition Test Harness</p>
        <h1 className="display-title mb-3 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          MediaPipe pose sandbox
        </h1>
        <p className="m-0 mb-6 max-w-2xl text-sm leading-7 text-[var(--sea-ink-soft)]">
          Enable the camera and watch the live pose skeleton. Toggle the phase
          to set the recognition <code>mode</code>. No detection algorithms are
          wired yet — this just proves the camera + MediaPipe pipeline runs.
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {PHASES.map((p) => (
            <button
              key={p.mode}
              type="button"
              onClick={() => setMode(p.mode)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                mode === p.mode
                  ? 'border-[rgba(50,143,151,0.5)] bg-[rgba(79,184,178,0.24)] text-[var(--lagoon-deep)]'
                  : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]'
              }`}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setCameraOn((v) => !v)}
            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)]"
          >
            {cameraOn ? 'Stop camera' : 'Enable camera'}
          </button>
          <span className="text-sm text-[var(--sea-ink-soft)]">
            current mode: <code>{mode}</code>
          </span>
        </div>

        <div className="mx-auto max-w-xl">
          {cameraOn && Recognition ? (
            <Recognition mode={mode} />
          ) : cameraOn ? (
            <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-black/80 text-sm text-white/80">
              Loading recognition…
            </div>
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--chip-bg)] text-sm text-[var(--sea-ink-soft)]">
              Camera is off. Click “Enable camera” to start.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
