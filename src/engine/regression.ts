export type TrendDirection = 'improving' | 'regressing' | 'stable'

const CHANGE_THRESHOLD = 0.1 // 10% — small fluctuation doesn't count as a real trend

/**
 * Weakness Forecast — most typing tools only ever show what's *currently*
 * slow. This flags a pair that's trending WORSE across recent sessions, not
 * just one that happens to be slow right now, by comparing the average of
 * the earlier half of its history to the average of the later half.
 */
export function detectTrendDirection(trend: number[]): TrendDirection {
  if (trend.length < 4) return 'stable' // too little history to call a real trend

  const mid = Math.floor(trend.length / 2)
  const earlier = average(trend.slice(0, mid))
  const later = average(trend.slice(mid))
  if (earlier <= 0) return 'stable'

  const change = (later - earlier) / earlier
  if (change > CHANGE_THRESHOLD) return 'regressing'
  if (change < -CHANGE_THRESHOLD) return 'improving'
  return 'stable'
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
