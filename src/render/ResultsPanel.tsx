import * as Comlink from 'comlink'
import { useEffect, useState } from 'react'
import type { MicroPause } from '../engine/fatigue'
import type { HeatmapEntry, SessionSummary } from '../engine/types'
import type { AdaptiveEngineApi } from '../engine/worker'
import { FatigueTimeline } from './FatigueTimeline'
import { KeycapChip } from './KeycapChip'
import { KeyboardHeatmap } from './KeyboardHeatmap'
import { Sparkline } from './Sparkline'

interface StatTileProps {
  value: string
  label: string
  valueClassName?: string
}

function StatTile({ value, label, valueClassName }: StatTileProps) {
  return (
    <div className="rounded border border-hairline bg-panel px-4 py-3">
      <div className={`kt-mono text-stat ${valueClassName ?? 'text-cream'}`}>{value}</div>
      <div className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-faint">{label}</div>
    </div>
  )
}

export function ResultsPanel({
  summary,
  api,
  microPauses,
  sessionDurationMs,
  onTypeAgain,
  onSwitchDomain,
  onViewHistory,
}: {
  summary: SessionSummary
  api: React.RefObject<Comlink.Remote<AdaptiveEngineApi> | null>
  microPauses: MicroPause[]
  sessionDurationMs: number
  onTypeAgain: () => void
  onSwitchDomain: () => void
  onViewHistory: () => void
}) {
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([])
  const [topPairTrend, setTopPairTrend] = useState<number[]>([])

  useEffect(() => {
    void api.current?.getHeatmapData().then((entries) => setHeatmap(entries))

    const topPairId = summary.top_pairs[0]?.pair
    if (topPairId) {
      void api.current?.getHistoryView(summary.domain_type, 10).then((view) => {
        const match = view.flaggedPairs.find((p) => p.pairId === topPairId)
        if (match) setTopPairTrend(match.trend)
      })
    }
    // Only ever needs to run once per session result, not on every summary field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const topPair = summary.top_pairs[0]
  const topPairDestKey = topPair?.pair.split('->')[1] ?? null
  const trendChangePct =
    topPairTrend.length >= 2 && topPairTrend[0] > 0
      ? ((topPairTrend[topPairTrend.length - 1] - topPairTrend[0]) / topPairTrend[0]) * 100
      : null

  return (
    <div className="kt-panel-enter flex flex-col gap-6 rounded border border-hairline bg-panel p-6">
      <span
        role="status"
        className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-signal-teal"
      >
        ◆ Session complete — {summary.domain_type} mode
      </span>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          value={summary.wpm_net.toFixed(0)}
          label="WPM Net"
          valueClassName="text-signal-teal"
        />
        <StatTile value={`${summary.accuracy.toFixed(1)}%`} label="Accuracy" />
        <StatTile
          value={`${(summary.burst_consistency * 100).toFixed(0)}%`}
          label="Burst consistency"
        />
        <StatTile
          value={
            trendChangePct === null
              ? '—'
              : `${trendChangePct > 0 ? '+' : ''}${trendChangePct.toFixed(0)}%`
          }
          label="Top-pair latency"
          valueClassName={
            trendChangePct !== null && trendChangePct < 0
              ? 'text-signal-teal'
              : 'text-friction-amber'
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-display text-h2 text-cream">Latency heatmap</h3>
        <KeyboardHeatmap entries={heatmap} hotKey={topPairDestKey} />
      </div>

      {topPair && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-h2 text-cream">
            <KeycapChip>{topPair.pair.replace('->', ' → ')}</KeycapChip> trend, last{' '}
            {Math.max(topPairTrend.length, 1)} sessions
          </h3>
          <Sparkline
            values={topPairTrend}
            color={trendChangePct !== null && trendChangePct < 0 ? '#4FD1C5' : '#FF8A5C'}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="font-display text-h2 text-cream">Fatigue & hesitation</h3>
        <FatigueTimeline pauses={microPauses} totalDurationMs={sessionDurationMs} />
      </div>

      {summary.top_pairs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-h2 text-cream">Slowest transitions this session</h3>
          <ul className="flex flex-wrap gap-2">
            {summary.top_pairs.map((pair) => (
              <li key={pair.pair} className="flex items-center gap-2">
                <KeycapChip>{pair.pair.replace('->', ' → ')}</KeycapChip>
                <span className="kt-mono text-body text-friction-amber">{pair.ms}ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onTypeAgain}
          className="kt-mono rounded bg-signal-teal px-4 py-2 text-body font-medium text-ink transition-colors duration-160 ease-kt-in-out hover:opacity-90"
        >
          Type again
        </button>
        <button
          type="button"
          onClick={onViewHistory}
          className="kt-mono rounded border border-hairline px-4 py-2 text-body font-medium text-cream transition-colors duration-160 ease-kt-in-out hover:border-signal-teal"
        >
          View history
        </button>
        <button
          type="button"
          onClick={onSwitchDomain}
          className="kt-mono rounded border border-hairline px-4 py-2 text-body font-medium text-cream transition-colors duration-160 ease-kt-in-out hover:border-signal-teal"
        >
          Switch domain
        </button>
      </div>
    </div>
  )
}
