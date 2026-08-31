// Shared main-thread <-> worker contract. Mirrors TRD §03 (KeyEvent), §07
// (Interface Contracts), and Backend Schema §02 (ngram_stats, session_logs).
export type Domain = 'CODE_TS' | 'CLI_BASH' | 'PROSE'

export interface KeyEvent {
  code: string
  char: string
  type: 'down' | 'up'
  t: number // performance.now() timestamp, captured on the main thread at input time
  domain: Domain
  // Set on printable 'down' events during an active session — main thread knows the
  // target text, so it marks correctness at capture time rather than the worker
  // needing a copy of the target text just to answer "was this right?"
  correct?: boolean
}

// Mirrors Backend Schema §02 TABLE: NGRAM_STATS. weight_wp is real starting Phase 2
// (TRD §04's W(P) formula, computed in ngramMatrix.ts on every update).
export interface PairStat {
  pair_id: string
  domain: Domain
  avg_latency_ms: number
  total_occurrences: number
  error_count: number
  weight_wp: number
  last_updated: number // Unix epoch ms
}

export interface TopPair {
  pair: string
  ms: number
}

// Mirrors Backend Schema §02 TABLE: SESSION_LOGS, plus `accuracy` — the schema doc
// doesn't list it as a stored column, but PRD FR-06/FR-12 require displaying it on
// the summary screen and it isn't derivable from the other stored fields, so it's
// persisted alongside them rather than silently dropped.
export interface SessionSummary {
  session_id: string
  domain_type: Domain
  wpm_raw: number
  wpm_net: number
  accuracy: number
  burst_consistency: number
  top_pairs: TopPair[]
  timestamp: number // Unix epoch ms, session completion time
}

// Mirrors Backend Schema §02 TABLE: SRS_QUEUE, plus `domain` — the schema doc's field
// table doesn't list it, but srs_queue is described as an FK into ngram_stats, which
// is itself keyed by [pair_id+domain], so an entry can't be resolved without it. Same
// reasoning as `accuracy` on SessionSummary above.
export interface SrsEntry {
  pair_id: string
  domain: Domain
  mastered_at: number
  next_review_at: number
  review_stage: number // 0-5, Backend Schema §02
}
