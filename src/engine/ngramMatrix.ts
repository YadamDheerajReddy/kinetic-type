import type { Domain, KeyEvent, PairStat, TopPair } from './types'
import { computeWeight } from './weighting'

const EWMA_LAMBDA = 0.15 // TRD §03: smoothing factor for avg_latency_ms

/**
 * Cross-batch state the matrix processor needs to carry forward: the keyup of the
 * most recently completed printable character, which becomes the reference point
 * for the *next* character's transit time (TRD §03: t_transit = t_keydown(k2) -
 * t_keyup(k1) — deliberately the release-to-press gap, not keydown-to-keydown,
 * since that's what actually measures finger travel time).
 */
export interface MatrixState {
  lastKeyUp: KeyEvent | null
}

export const initialMatrixState: MatrixState = { lastKeyUp: null }

function isPrintable(event: KeyEvent): boolean {
  return event.char.length === 1
}

function updatePairStat(
  existing: PairStat | undefined,
  pairId: string,
  domain: Domain,
  transitMs: number,
  isError: boolean,
  now: number,
): PairStat {
  const avg = existing
    ? EWMA_LAMBDA * transitMs + (1 - EWMA_LAMBDA) * existing.avg_latency_ms
    : transitMs
  const totalOccurrences = (existing?.total_occurrences ?? 0) + 1
  const errorCount = (existing?.error_count ?? 0) + (isError ? 1 : 0)

  return {
    pair_id: pairId,
    domain,
    avg_latency_ms: avg,
    total_occurrences: totalOccurrences,
    error_count: errorCount,
    weight_wp: computeWeight({
      avg_latency_ms: avg,
      error_count: errorCount,
      total_occurrences: totalOccurrences,
    }),
    last_updated: now,
  }
}

export interface ProcessBatchResult {
  state: MatrixState
  updatedStats: PairStat[]
  // session-local transit times per pair, for the session's top_pairs summary —
  // kept separate from the persisted EWMA average, which is an all-time figure
  sessionLatencies: Array<{ pairId: string; ms: number }>
}

/**
 * Folds a batch of KeyEvents into the n-gram latency matrix. Only transitions
 * between two printable-character keydowns count; anything spanning a discarded
 * (e.g. tab-backgrounded) sample never reaches here since the caller filters
 * those out before batching (App Flow §08).
 */
export function processKeyEventBatch(
  events: KeyEvent[],
  state: MatrixState,
  existingStats: ReadonlyMap<string, PairStat>,
): ProcessBatchResult {
  let lastKeyUp = state.lastKeyUp
  const updatedStats: PairStat[] = []
  const sessionLatencies: Array<{ pairId: string; ms: number }> = []
  const workingStats = new Map(existingStats)

  for (const event of events) {
    if (!isPrintable(event)) continue

    if (event.type === 'down' && lastKeyUp) {
      const pairId = `${lastKeyUp.char}->${event.char}`
      const transitMs = event.t - lastKeyUp.t
      if (transitMs >= 0) {
        const updated = updatePairStat(
          workingStats.get(pairId),
          pairId,
          event.domain,
          transitMs,
          event.correct === false,
          event.t,
        )
        workingStats.set(pairId, updated)
        updatedStats.push(updated)
        sessionLatencies.push({ pairId, ms: transitMs })
      }
    }

    if (event.type === 'up') {
      lastKeyUp = event
    }
  }

  return { state: { lastKeyUp }, updatedStats, sessionLatencies }
}

/**
 * Session-local "your slowest transitions today" list (PRD FR-12 / session_logs
 * .top_pairs_json) — deliberately computed from this session's own samples, not
 * the persisted all-time EWMA, so it reflects what actually happened just now.
 */
export function computeTopPairs(
  sessionLatencies: Array<{ pairId: string; ms: number }>,
  limit: number,
): TopPair[] {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const { pairId, ms } of sessionLatencies) {
    const entry = totals.get(pairId) ?? { sum: 0, count: 0 }
    entry.sum += ms
    entry.count += 1
    totals.set(pairId, entry)
  }

  return [...totals.entries()]
    .map(([pair, { sum, count }]) => ({ pair, ms: Math.round(sum / count) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit)
}
