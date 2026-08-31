import type { FingerLoad } from '../engine/fingerMap'
import { rampColor } from './heatmapColor'

/**
 * Finger-Load Analysis — a more actionable cut of the same latency data as
 * the key heatmap: "your left index finger is the bottleneck" points at an
 * actual habit to work on, not just one key among many.
 */
export function FingerLoadChart({ loads }: { loads: FingerLoad[] }) {
  if (loads.length === 0) {
    return (
      <p className="kt-mono text-body text-faint">
        No finger-level data yet — type a bit more and this fills in.
      </p>
    )
  }

  const max = Math.max(...loads.map((l) => l.avgLatencyMs))
  const min = Math.min(...loads.map((l) => l.avgLatencyMs))
  const range = max - min || 1
  const slowest = loads.reduce((a, b) => (b.avgLatencyMs > a.avgLatencyMs ? b : a))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {loads.map((load) => {
          const t = (load.avgLatencyMs - min) / range
          const widthPct = 20 + t * 80 // keep even the fastest finger's bar visible
          return (
            <div key={load.finger} className="flex items-center gap-2">
              <span className="kt-mono w-24 shrink-0 text-body text-faint">{load.finger}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-hairline">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${widthPct}%`, backgroundColor: rampColor(t) }}
                />
              </div>
              <span className="kt-mono w-14 shrink-0 text-right text-body text-faint">
                {load.avgLatencyMs.toFixed(0)}ms
              </span>
            </div>
          )
        })}
      </div>
      <p className="kt-mono text-body text-faint">
        Bottleneck: <span className="text-friction-amber">{slowest.finger}</span>
      </p>
    </div>
  )
}
