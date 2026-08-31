import type { SessionSummary } from '../engine/types'
import { KeycapChip } from './KeycapChip'

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
  onTypeAgain,
}: {
  summary: SessionSummary
  onTypeAgain: () => void
}) {
  return (
    <div className="flex flex-col gap-6 rounded border border-hairline bg-panel p-6">
      <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-signal-teal">
        ◆ Session complete — {summary.domain_type} mode
      </span>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      </div>

      {summary.top_pairs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-h2 text-cream">Slowest transitions this session</h3>
          <p className="text-body text-faint">
            Real per-pair diagnosis (the heatmap, trends over time) arrives in Phase 3 — for now,
            here's what this session found.
          </p>
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

      <button
        type="button"
        onClick={onTypeAgain}
        className="kt-mono self-start rounded bg-signal-teal px-4 py-2 text-body font-medium text-ink transition-colors duration-160 ease-kt-in-out hover:opacity-90"
      >
        Type again
      </button>
    </div>
  )
}
