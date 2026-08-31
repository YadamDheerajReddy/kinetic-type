import * as Comlink from 'comlink'
import { useEffect, useState } from 'react'
import { DOMAIN_LEXERS } from '../domains'
import type { HistoryView as HistoryViewData } from '../engine/session'
import type { Domain } from '../engine/types'
import type { AdaptiveEngineApi } from '../engine/worker'
import { KeycapChip } from './KeycapChip'
import { Sparkline } from './Sparkline'

/**
 * History & Trends — App Flow §05 Step 3: "A rolling view plots the user's
 * previously-flagged weak pairs over time ... the primary evidence of the
 * product working." Reachable from Results via "View History" (§05 exit point).
 */
export function HistoryView({
  api,
  domain,
  onBack,
}: {
  api: React.RefObject<Comlink.Remote<AdaptiveEngineApi> | null>
  domain: Domain
  onBack: () => void
}) {
  const [data, setData] = useState<HistoryViewData | null>(null)

  useEffect(() => {
    let cancelled = false
    void api.current?.getHistoryView(domain, 10).then((result) => {
      if (!cancelled) setData(result)
    })
    return () => {
      cancelled = true
    }
  }, [api, domain])

  const lexer = DOMAIN_LEXERS[domain]
  const wpmTrend = data?.sessions
    .slice()
    .reverse()
    .map((s) => s.wpm_net)
  const accuracyTrend = data?.sessions
    .slice()
    .reverse()
    .map((s) => s.accuracy)

  return (
    <div className="flex flex-col gap-6 rounded border border-hairline bg-panel p-6">
      <div className="flex items-center justify-between">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-signal-teal">
          ◆ History & trends — {lexer.label} mode
        </span>
        <button
          type="button"
          onClick={onBack}
          className="kt-mono rounded border border-hairline px-3 py-1 text-body text-cream transition-colors duration-160 ease-kt-in-out hover:border-signal-teal"
        >
          Back
        </button>
      </div>

      {!data ? (
        <p className="kt-mono text-body text-faint">Loading…</p>
      ) : data.sessions.length === 0 ? (
        <p className="kt-mono text-body text-faint">
          No sessions in {lexer.label} mode yet — finish one to start building history.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-h2 text-cream">
                WPM Net, last {data.sessions.length} sessions
              </h3>
              <Sparkline values={wpmTrend ?? []} color="#4FD1C5" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-h2 text-cream">
                Accuracy, last {data.sessions.length} sessions
              </h3>
              <Sparkline values={accuracyTrend ?? []} color="#6D8BFF" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-display text-h2 text-cream">Your most-flagged transitions</h3>
            {data.flaggedPairs.length === 0 ? (
              <p className="kt-mono text-body text-faint">
                Nothing flagged repeatedly yet — keep practicing and patterns will show up here.
              </p>
            ) : (
              data.flaggedPairs.map(({ pairId, trend }) => {
                const improving = trend.length >= 2 && trend[trend.length - 1] < trend[0]
                return (
                  <div key={pairId} className="flex items-center justify-between gap-4">
                    <KeycapChip>{pairId.replace('->', ' → ')}</KeycapChip>
                    <Sparkline
                      values={trend}
                      color={improving ? '#4FD1C5' : '#FF8A5C'}
                      width={120}
                      height={32}
                    />
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
