import { useState } from 'react'
import { useAdaptiveEngine } from '../engine/useAdaptiveEngine'
import type { MicroPause } from '../engine/fatigue'
import type { Domain, SessionSummary } from '../engine/types'
import { DomainSelect } from '../render/DomainSelect'
import { HistoryView } from '../render/HistoryView'
import { ResultsPanel } from '../render/ResultsPanel'
import { TypingStage } from '../render/TypingStage'

type Status = 'idle' | 'active' | 'complete' | 'history'

// App Flow §02: "Domain selection persists locally as the default for next visit."
const LAST_DOMAIN_KEY = 'kinetic-type:last-domain'

function isDomain(value: string | null): value is Domain {
  return value === 'CODE_TS' || value === 'CLI_BASH' || value === 'PROSE'
}

// null means "never used the app before" — distinct from any real Domain value,
// so the idle screen knows whether there's anything to offer resuming.
function loadLastDomain(): Domain | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(LAST_DOMAIN_KEY)
  return isDomain(stored) ? stored : null
}

export function App() {
  const { api, ready } = useAdaptiveEngine()
  const [status, setStatus] = useState<Status>('idle')
  const [lastDomain, setLastDomain] = useState<Domain | null>(loadLastDomain)
  const [domain, setDomain] = useState<Domain>(() => loadLastDomain() ?? 'PROSE')
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [microPauses, setMicroPauses] = useState<MicroPause[]>([])
  const [sessionDurationMs, setSessionDurationMs] = useState(0)

  function handleSelectDomain(selected: Domain) {
    setDomain(selected)
    setLastDomain(selected)
    window.localStorage.setItem(LAST_DOMAIN_KEY, selected)
    setSummary(null)
    setStatus('active')
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-engine-violet">
          Phase 3 — Visual Analytics & Polish
        </span>
        <h1 className="font-display text-display text-cream">
          Kinetic <span className="text-signal-teal">Type</span>
        </h1>
        <p className="text-body text-faint">
          A dark instrument panel that turns your own hands into the interface. The engine learns
          your slowest transitions and weaves them back into what you type next — now with a
          heatmap, fatigue detection, and trend history to show it working. Cloud sync arrives in
          Phase 4.
        </p>
      </header>

      {status === 'idle' &&
        (ready ? (
          <DomainSelect lastDomain={lastDomain} onSelect={handleSelectDomain} />
        ) : (
          <p className="kt-mono text-body text-faint">Connecting…</p>
        ))}

      {status === 'active' && (
        <TypingStage
          api={api}
          domain={domain}
          onComplete={(result, pauses, durationMs) => {
            setSummary(result)
            setMicroPauses(pauses)
            setSessionDurationMs(durationMs)
            setStatus('complete')
          }}
        />
      )}

      {status === 'complete' && summary && (
        <ResultsPanel
          summary={summary}
          api={api}
          microPauses={microPauses}
          sessionDurationMs={sessionDurationMs}
          onTypeAgain={() => setStatus('active')}
          onSwitchDomain={() => setStatus('idle')}
          onViewHistory={() => setStatus('history')}
        />
      )}

      {status === 'history' && (
        <HistoryView api={api} domain={domain} onBack={() => setStatus('complete')} />
      )}
    </div>
  )
}
