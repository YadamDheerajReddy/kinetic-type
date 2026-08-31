import { useState } from 'react'
import { useAdaptiveEngine } from '../engine/useAdaptiveEngine'
import type { SessionSummary } from '../engine/types'
import { ResultsPanel } from '../render/ResultsPanel'
import { TypingStage } from '../render/TypingStage'

type Status = 'idle' | 'active' | 'complete'

export function App() {
  const { api, ready } = useAdaptiveEngine()
  const [status, setStatus] = useState<Status>('idle')
  const [summary, setSummary] = useState<SessionSummary | null>(null)

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-engine-violet">
          Phase 1 — Engine Foundation
        </span>
        <h1 className="font-display text-display text-cream">
          Kinetic <span className="text-signal-teal">Type</span>
        </h1>
        <p className="text-body text-faint">
          A dark instrument panel that turns your own hands into the interface. Dev and CLI modes,
          the adaptive engine, and the full analytics view arrive in later phases — this is an
          honest Prose-mode typing test with real timing precision.
        </p>
      </header>

      {status === 'idle' && (
        <section className="flex flex-col items-start gap-4 rounded border border-hairline bg-panel p-6">
          <p className="text-body text-faint">
            No account needed. Press start and begin typing — your baseline calibrates as you go.
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              setSummary(null)
              setStatus('active')
            }}
            className="kt-mono rounded bg-signal-teal px-4 py-2 text-body font-medium text-ink transition-colors duration-160 ease-kt-in-out hover:opacity-90 disabled:opacity-50"
          >
            {ready ? 'Start session' : 'Connecting…'}
          </button>
        </section>
      )}

      {status === 'active' && (
        <TypingStage
          api={api}
          onComplete={(result) => {
            setSummary(result)
            setStatus('complete')
          }}
        />
      )}

      {status === 'complete' && summary && (
        <ResultsPanel summary={summary} onTypeAgain={() => setStatus('active')} />
      )}
    </div>
  )
}
