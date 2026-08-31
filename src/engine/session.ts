import { db } from '../data/db'
import { computeTopPairs, initialMatrixState, processKeyEventBatch } from './ngramMatrix'
import type { Domain, KeyEvent, PairStat, SessionSummary } from './types'

/**
 * Session orchestration — runs inside the Adaptive Engine worker (worker.ts just
 * exposes these over Comlink). Owns the module-level state for whichever session
 * is currently active; a dedicated worker only ever runs one session at a time,
 * so a singleton is the right shape here, not a class needing instantiation.
 */
let matrixState = initialMatrixState
let statsCache = new Map<string, PairStat>()
let sessionLatencies: Array<{ pairId: string; ms: number }> = []

export async function startSession(domain: Domain): Promise<void> {
  matrixState = initialMatrixState
  sessionLatencies = []
  const rows = await db.ngram_stats.where('domain').equals(domain).toArray()
  statsCache = new Map(rows.map((row) => [row.pair_id, row]))
}

/**
 * Called when the tab is backgrounded (App Flow §08: "Tab backgrounded mid-session
 * ... in-flight latency samples spanning the visibility change are discarded").
 * Clears the keyup anchor so the next keystroke after returning starts a fresh
 * pairing instead of computing a transit time across the background gap.
 */
export function resetPairing(): void {
  matrixState = initialMatrixState
}

export async function processBatch(events: KeyEvent[]): Promise<void> {
  const result = processKeyEventBatch(events, matrixState, statsCache)
  matrixState = result.state
  for (const stat of result.updatedStats) statsCache.set(stat.pair_id, stat)
  sessionLatencies.push(...result.sessionLatencies)

  // Per TRD's engineering constraint, this write is off the typing-critical path —
  // it happens after the batch has already been folded into in-memory state, and
  // the caller doesn't await UI feedback on it.
  if (result.updatedStats.length > 0) {
    await db.ngram_stats.bulkPut(result.updatedStats)
  }
}

export async function endSession(
  partial: Omit<SessionSummary, 'top_pairs'>,
): Promise<SessionSummary> {
  const summary: SessionSummary = { ...partial, top_pairs: computeTopPairs(sessionLatencies, 5) }
  await db.session_logs.put(summary)
  return summary
}
