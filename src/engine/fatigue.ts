// Micro-pause detection — PRD glossary: "An anomalous gap between keystrokes,
// statistically distinct from normal transition latency, used as a
// fatigue/hesitation signal." FR-07 (P1).
export interface MicroPause {
  atMs: number // time since the first keystroke when the pause occurred
  gapMs: number
}

/**
 * Flags inter-keystroke gaps that are real outliers for THIS session's own
 * rhythm, scaled off percentiles rather than mean/MAD. Real typing has a
 * meaningful chunk of ordinary word-boundary gaps sitting just above the
 * median — a mean+MAD threshold breaks down there, since MAD measures the
 * spread of the *tight* bulk of fast within-word gaps and stays small even
 * when 10-20% of gaps are legitimately slower, so nearly every one of those
 * normal gaps ends up flagged (an earlier version of this function did
 * exactly that — 50+ "pauses" in an ordinary session). Anchoring off p90
 * instead means at most the slowest ~10% of gaps are even candidates, and
 * they still have to clear a floor well above typical word-boundary
 * friction to count as a real hesitation.
 */
export function detectMicroPauses(timestamps: number[]): MicroPause[] {
  if (timestamps.length < 10) return [] // too little data to tell "unusual" from "normal"

  const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i])
  const sorted = [...gaps].sort((a, b) => a - b)
  const p50 = percentileOf(sorted, 0.5)
  const p90 = percentileOf(sorted, 0.9)
  const threshold = Math.max(p90 * 1.8, p50 * 5, 500)

  const pauses: MicroPause[] = []
  const sessionStart = timestamps[0]
  gaps.forEach((gap, i) => {
    if (gap > threshold) {
      pauses.push({ atMs: timestamps[i + 1] - sessionStart, gapMs: gap })
    }
  })
  return pauses
}

function percentileOf(sortedValues: number[], p: number): number {
  return sortedValues[Math.floor(sortedValues.length * p)]
}
