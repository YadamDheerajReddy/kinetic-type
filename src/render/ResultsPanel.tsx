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
  onSwitchDomain,
}: {
  summary: SessionSummary
  onTypeAgain: () => void
  onSwitchDomain: () => void
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
            These are the pairs the adaptive engine will start weaving back into your next sessions
            to drill — the "Targeted pair" stat during typing shows it happening live.
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

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onTypeAgain}
          className="kt-mono rounded bg-signal-teal px-4 py-2 text-body font-medium text-ink transition-colors duration-160 ease-kt-in-out hover:opacity-90"
        >
          Type again
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
