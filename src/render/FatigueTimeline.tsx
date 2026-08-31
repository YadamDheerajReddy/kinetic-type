import type { MicroPause } from '../engine/fatigue'

/**
 * Micro-pause / fatigue timeline — PRD FR-07: surfaces anomalous inter-key
 * gaps (hesitation/fatigue signal) as an annotated horizontal timeline.
 */
export function FatigueTimeline({
  pauses,
  totalDurationMs,
}: {
  pauses: MicroPause[]
  totalDurationMs: number
}) {
  if (totalDurationMs <= 0) return null

  if (pauses.length === 0) {
    return (
      <p className="kt-mono text-body text-faint">
        No unusual hesitations detected — a steady session start to finish.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative h-2 rounded-full bg-hairline"
        role="img"
        aria-label={`${pauses.length} unusual pause${pauses.length === 1 ? '' : 's'} detected during the session`}
      >
        {pauses.map((pause, i) => (
          <div
            key={i}
            title={`${(pause.gapMs / 1000).toFixed(1)}s pause at ${(pause.atMs / 1000).toFixed(0)}s in`}
            className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-friction-amber"
            style={{ left: `${Math.min(100, (pause.atMs / totalDurationMs) * 100)}%` }}
          />
        ))}
      </div>
      <p className="kt-mono text-body text-faint">
        {pauses.length} unusual {pauses.length === 1 ? 'pause' : 'pauses'} detected — possible
        hesitation or fatigue, longest {(Math.max(...pauses.map((p) => p.gapMs)) / 1000).toFixed(1)}
        s.
      </p>
    </div>
  )
}
