import * as Comlink from 'comlink'
import { useEffect, useState } from 'react'
import { DOMAIN_LEXERS } from '../domains'
import { detectTrendDirection } from '../engine/regression'
import type { HistoryView as HistoryViewData } from '../engine/session'
import type { Domain } from '../engine/types'
import type { AdaptiveEngineApi } from '../engine/worker'
import { downloadCsv, sessionsToCsv } from './csvExport'
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
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api.current?.getHistoryView(domain, 10).then((result) => {
      if (!cancelled) setData(result)
    })
    return () => {
      cancelled = true
    }
  }, [api, domain])

  async function handleExport() {
    setExporting(true)
    try {
      const sessions = await api.current?.exportSessionHistory(domain)
      if (sessions && sessions.length > 0) {
        downloadCsv(`kinetic-type-${domain.toLowerCase()}-history.csv`, sessionsToCsv(sessions))
      }
    } finally {
      setExporting(false)
    }
  }

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || !data || data.sessions.length === 0}
            className="kt-mono rounded border border-hairline px-3 py-1 text-body text-cream transition-colors duration-160 ease-kt-in-out hover:border-signal-teal disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="kt-mono rounded border border-hairline px-3 py-1 text-body text-cream transition-colors duration-160 ease-kt-in-out hover:border-signal-teal"
          >
            Back
          </button>
        </div>
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
            <p className="text-body text-faint">
              Weakness Forecast: pairs trending worse across recent sessions are flagged, not just
              whatever's currently slow.
            </p>
            {data.flaggedPairs.length === 0 ? (
              <p className="kt-mono text-body text-faint">
                Nothing flagged repeatedly yet — keep practicing and patterns will show up here.
              </p>
            ) : (
              data.flaggedPairs.map(({ pairId, trend }) => {
                const direction = detectTrendDirection(trend)
                return (
                  <div key={pairId} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <KeycapChip>{pairId.replace('->', ' → ')}</KeycapChip>
                      {direction === 'regressing' && (
                        <span className="kt-mono text-body text-friction-amber">▲ regressing</span>
                      )}
                      {direction === 'improving' && (
                        <span className="kt-mono text-body text-signal-teal">▼ improving</span>
                      )}
                    </div>
                    <Sparkline
                      values={trend}
                      color={direction === 'regressing' ? '#FF8A5C' : '#4FD1C5'}
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
