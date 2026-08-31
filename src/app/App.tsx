import { useState } from 'react'
import { useAdaptiveEngine } from '../engine/useAdaptiveEngine'
import type { Domain, SessionSummary } from '../engine/types'
import { DomainSelect } from '../render/DomainSelect'
import { ResultsPanel } from '../render/ResultsPanel'
import { TypingStage } from '../render/TypingStage'

type Status = 'idle' | 'active' | 'complete'

// App Flow §02: "Domain selection persists locally as the default for next visit."
const LAST_DOMAIN_KEY = 'kinetic-type:last-domain'

function isDomain(value: string | null): value is Domain {
  return value === 'CODE_TS' || value === 'CLI_BASH' || value === 'PROSE'
}

function loadLastDomain(): Domain {
  if (typeof window === 'undefined') return 'PROSE'
  const stored = window.localStorage.getItem(LAST_DOMAIN_KEY)
  return isDomain(stored) ? stored : 'PROSE'
}

export function App() {
  const { api, ready } = useAdaptiveEngine()
  const [status, setStatus] = useState<Status>('idle')
  const [domain, setDomain] = useState<Domain>(loadLastDomain)
  const [summary, setSummary] = useState<SessionSummary | null>(null)

  function handleSelectDomain(selected: Domain) {
    setDomain(selected)
    window.localStorage.setItem(LAST_DOMAIN_KEY, selected)
    setSummary(null)
    setStatus('active')
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-engine-violet">
          Phase 2 — Adaptive Engine & Domains
        </span>
        <h1 className="font-display text-display text-cream">
          Kinetic <span className="text-signal-teal">Type</span>
        </h1>
        <p className="text-body text-faint">
          A dark instrument panel that turns your own hands into the interface. The engine now
          learns your slowest transitions and weaves them back into what you type next — the full
          analytics view and cloud sync arrive in later phases.
        </p>
      </header>

      {status === 'idle' &&
        (ready ? (
          <DomainSelect onSelect={handleSelectDomain} />
        ) : (
          <p className="kt-mono text-body text-faint">Connecting…</p>
        ))}

      {status === 'active' && (
        <TypingStage
          api={api}
          domain={domain}
          onComplete={(result) => {
            setSummary(result)
            setStatus('complete')
          }}
        />
      )}

      {status === 'complete' && summary && (
        <ResultsPanel
          summary={summary}
          onTypeAgain={() => setStatus('active')}
          onSwitchDomain={() => setStatus('idle')}
        />
      )}
    </div>
  )
}
