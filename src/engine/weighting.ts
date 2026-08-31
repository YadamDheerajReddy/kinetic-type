import type { PairStat } from './types'

// TRD §04: default error weight multiplier, tunable per-domain via remote config
// (no remote config exists yet — a fixed default is the honest Phase 2 scope).
const DEFAULT_ALPHA = 2.5

export function computeErrorRate(
  stat: Pick<PairStat, 'error_count' | 'total_occurrences'>,
): number {
  if (stat.total_occurrences <= 0) return 0
  return Math.min(1, Math.max(0, stat.error_count / stat.total_occurrences))
}

/**
 * W(P) = L(P) x (1 + alpha x E(P)) — TRD §04. Pairs that are both slow and
 * error-prone get pushed to the front of the targeting queue hardest.
 */
export function computeWeight(
  stat: Pick<PairStat, 'avg_latency_ms' | 'error_count' | 'total_occurrences'>,
  alpha = DEFAULT_ALPHA,
): number {
  return stat.avg_latency_ms * (1 + alpha * computeErrorRate(stat))
}
