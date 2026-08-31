import { DOMAIN_LEXERS } from '../domains'
import { db } from '../data/db'
import { computeTopPairs, initialMatrixState, processKeyEventBatch } from './ngramMatrix'
import { reconcileSrsEntry, selectDuePairs } from './srs'
import { checkPersonalBest, todayUtc, updateStreak } from './streaks'
import { synthesizeText } from './synthesizer'
import type {
  Domain,
  HeatmapEntry,
  KeyEvent,
  PairStat,
  PersonalBest,
  SessionSummary,
  SrsEntry,
  StreakRecord,
} from './types'

/**
 * Session orchestration — runs inside the Adaptive Engine worker (worker.ts just
 * exposes these over Comlink). Owns the module-level state for whichever session
 * is currently active; a dedicated worker only ever runs one session at a time,
 * so a singleton is the right shape here, not a class needing instantiation.
 */
let activeDomain: Domain = 'PROSE'
let matrixState = initialMatrixState
let statsCache = new Map<string, PairStat>()
let srsCache = new Map<string, SrsEntry>()
let sessionLatencies: Array<{ pairId: string; ms: number }> = []

export async function startSession(domain: Domain): Promise<void> {
  activeDomain = domain
  matrixState = initialMatrixState
  sessionLatencies = []

  const [statRows, srsRows] = await Promise.all([
    db.ngram_stats.where('domain').equals(domain).toArray(),
    db.srs_queue.where('domain').equals(domain).toArray(),
  ])
  statsCache = new Map(statRows.map((row) => [row.pair_id, row]))
  srsCache = new Map(srsRows.map((row) => [row.pair_id, row]))
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

function domainAverageWeight(): number {
  if (statsCache.size === 0) return 0
  let sum = 0
  for (const stat of statsCache.values()) sum += stat.weight_wp
  return sum / statsCache.size
}

export async function processBatch(events: KeyEvent[]): Promise<void> {
  const result = processKeyEventBatch(events, matrixState, statsCache)
  matrixState = result.state

  const now = Date.now()
  const avgWeight = domainAverageWeight()
  const srsUpserts: SrsEntry[] = []
  const srsRemovals: string[] = []

  for (const stat of result.updatedStats) {
    statsCache.set(stat.pair_id, stat)

    const existingSrs = srsCache.get(stat.pair_id)
    const reconciled = reconcileSrsEntry(stat, existingSrs, avgWeight, now)
    if (reconciled) {
      srsCache.set(stat.pair_id, reconciled)
      srsUpserts.push(reconciled)
    } else if (existingSrs) {
      srsCache.delete(stat.pair_id)
      srsRemovals.push(stat.pair_id)
    }
  }

  sessionLatencies.push(...result.sessionLatencies)

  // Off the typing-critical path: state is already updated in memory above,
  // and the caller doesn't await UI feedback on these writes landing.
  const writes: Promise<unknown>[] = []
  if (result.updatedStats.length > 0) writes.push(db.ngram_stats.bulkPut(result.updatedStats))
  if (srsUpserts.length > 0) writes.push(db.srs_queue.bulkPut(srsUpserts))
  for (const pairId of srsRemovals) writes.push(db.srs_queue.delete([pairId, activeDomain]))
  if (writes.length > 0) await Promise.all(writes)
}

export interface NextChunk {
  text: string
  targetedPair: string | null
}

/**
 * TRD §04 Text Selection Protocol, run live against the current in-memory
 * matrix — not once at session start, but every time the main thread's buffer
 * runs low (< 40 chars, TRD §04 Worker Execution Budget), so a pair fumbled
 * mid-session re-enters the stream within seconds.
 */
export async function getNextChunk(
  minChars: number,
  mode: 'adaptive' | 'drill' = 'adaptive',
): Promise<NextChunk> {
  const lexer = DOMAIN_LEXERS[activeDomain]
  const now = Date.now()
  const dueSrsPairIds = selectDuePairs([...srsCache.values()], now).map((entry) => entry.pair_id)

  const topPair = [...statsCache.values()]
    .filter((pair) => pair.weight_wp > 0)
    .sort((a, b) => b.weight_wp - a.weight_wp)[0]

  const text = synthesizeText({
    words: lexer.words,
    weightedPairs: [...statsCache.values()],
    dueSrsPairIds,
    targetLength: minChars,
    // Focused Drill Mode: no contextual flow, every word hits a weak pair.
    targetRatio: mode === 'drill' ? 1 : undefined,
  })

  return { text, targetedPair: topPair?.pair_id ?? null }
}

export async function endSession(
  partial: Omit<SessionSummary, 'top_pairs'>,
): Promise<SessionSummary> {
  const summary: SessionSummary = { ...partial, top_pairs: computeTopPairs(sessionLatencies, 5) }

  const historyEntries = summary.top_pairs.map((pair) => ({
    pair_id: pair.pair,
    domain: summary.domain_type,
    avg_latency_ms: pair.ms,
    timestamp: summary.timestamp,
  }))

  await Promise.all([
    db.session_logs.put(summary),
    historyEntries.length > 0 ? db.pair_history.bulkAdd(historyEntries) : Promise.resolve(),
  ])

  return summary
}

/**
 * Latency heatmap (UI/UX Brief §08) — average transition time into each
 * destination key, weighted by each contributing pair's occurrence count.
 * Uses the in-memory cache from the session that just ended, not a fresh
 * query, so it's ready the instant endSession resolves.
 */
export async function getHeatmapData(): Promise<HeatmapEntry[]> {
  const byKey = new Map<string, { weightedSum: number; occurrences: number }>()

  for (const stat of statsCache.values()) {
    const destKey = stat.pair_id.split('->')[1]
    if (!destKey) continue
    const entry = byKey.get(destKey) ?? { weightedSum: 0, occurrences: 0 }
    entry.weightedSum += stat.avg_latency_ms * stat.total_occurrences
    entry.occurrences += stat.total_occurrences
    byKey.set(destKey, entry)
  }

  return [...byKey.entries()].map(([key, { weightedSum, occurrences }]) => ({
    key,
    avgLatencyMs: occurrences > 0 ? weightedSum / occurrences : 0,
    occurrences,
  }))
}

export interface HistoryView {
  sessions: SessionSummary[]
  flaggedPairs: Array<{ pairId: string; trend: number[] }>
}

/**
 * History & Trends (App Flow §05): recent session WPM/accuracy history for
 * this domain, plus the most-frequently-flagged pairs' own latency trend —
 * "the primary evidence of the product working."
 */
export async function getHistoryView(domain: Domain, sessionLimit = 10): Promise<HistoryView> {
  const sessions = await db.session_logs
    .where('[domain_type+timestamp]')
    .between([domain, 0], [domain, Infinity])
    .reverse()
    .limit(sessionLimit)
    .toArray()

  const frequency = new Map<string, number>()
  for (const session of sessions) {
    for (const pair of session.top_pairs) {
      frequency.set(pair.pair, (frequency.get(pair.pair) ?? 0) + 1)
    }
  }
  const topFlagged = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pairId]) => pairId)

  const flaggedPairs = await Promise.all(
    topFlagged.map(async (pairId) => {
      const rows = await db.pair_history
        .where('[pair_id+domain]')
        .equals([pairId, domain])
        .reverse()
        .limit(sessionLimit)
        .toArray()
      return { pairId, trend: rows.reverse().map((row) => row.avg_latency_ms) }
    }),
  )

  return { sessions, flaggedPairs }
}

export interface MilestoneResult {
  streak: StreakRecord
  personalBest: PersonalBest
  isNewWpmBest: boolean
  isNewAccuracyBest: boolean
}

/**
 * Streaks & Personal Bests — separate from endSession/session_logs (Backend
 * Schema's persisted contract) since these are a new, client-side-only
 * concept layered on top, not part of the original schema. Called right
 * after endSession from the main thread.
 */
export async function updateMilestones(
  domain: Domain,
  wpmNet: number,
  accuracy: number,
  timestamp: number,
): Promise<MilestoneResult> {
  const [existingStreak, existingBest] = await Promise.all([
    db.streaks.get(domain),
    db.personal_bests.get(domain),
  ])

  const streak = updateStreak(existingStreak, domain, todayUtc(timestamp))
  const {
    record: personalBest,
    isNewWpmBest,
    isNewAccuracyBest,
  } = checkPersonalBest(existingBest, domain, wpmNet, accuracy, timestamp)

  await Promise.all([db.streaks.put(streak), db.personal_bests.put(personalBest)])

  return { streak, personalBest, isNewWpmBest, isNewAccuracyBest }
}

/** Export Your Data: the user's full session history for one domain, no limit. */
export async function exportSessionHistory(domain: Domain): Promise<SessionSummary[]> {
  return db.session_logs
    .where('[domain_type+timestamp]')
    .between([domain, 0], [domain, Infinity])
    .reverse()
    .toArray()
}
