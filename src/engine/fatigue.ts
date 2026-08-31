// Micro-pause detection — PRD glossary: "An anomalous gap between keystrokes,
// statistically distinct from normal transition latency, used as a
// fatigue/hesitation signal." FR-07 (P1).
export interface MicroPause {
  atMs: number // time since the first keystroke when the pause occurred
  gapMs: number
}

/**
 * Flags inter-keystroke gaps that are outliers relative to this session's own
 * rhythm — median + a robust spread measure (MAD), not a fixed millisecond
 * cutoff, since typing cadence varies hugely between users and domains. A
 * floor (250ms) keeps tiny, noise-free sessions from flagging normal gaps.
 */
export function detectMicroPauses(timestamps: number[]): MicroPause[] {
  if (timestamps.length < 3) return []

  const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i])
  const median = percentile(gaps, 0.5)
  const deviations = gaps.map((g) => Math.abs(g - median))
  const mad = percentile(deviations, 0.5) || 1
  const threshold = Math.max(median + 4 * mad, median * 3, 250)

  const pauses: MicroPause[] = []
  const sessionStart = timestamps[0]
  gaps.forEach((gap, i) => {
    if (gap > threshold) {
      pauses.push({ atMs: timestamps[i + 1] - sessionStart, gapMs: gap })
    }
  })
  return pauses
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * p)]
}
