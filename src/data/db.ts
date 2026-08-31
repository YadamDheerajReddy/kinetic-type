import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Domain,
  PairHistoryEntry,
  PairStat,
  PersonalBest,
  SessionSummary,
  SrsEntry,
  StreakRecord,
} from '../engine/types'

/**
 * Local-first persistence — Backend Schema §02. IndexedDB is the permanent source
 * of truth on every device; Firestore (Phase 4) is only ever a backup mirror and
 * is never read from to render the app (TRD §01, §06).
 *
 * This runs inside the Adaptive Engine worker, not the main thread — the worker
 * owns the Local Data Tier per the architecture diagram (TRD §01), and IndexedDB
 * is available in a dedicated worker's global scope.
 *
 * Primary key for ngram_stats and srs_queue is [pair_id+domain], not pair_id
 * alone: a pair's stats are tracked independently per domain (Backend Schema
 * §04 cardinality note — "Shift→{" behaves differently in Dev Mode vs. Prose Mode).
 */
export class KineticTypeDB extends Dexie {
  // Compound primary key [pair_id+domain] isn't a single `keyof T`, so these use
  // the plain Table type instead of EntityTable (which assumes a single key field).
  ngram_stats!: Table<PairStat, [string, Domain]>
  session_logs!: EntityTable<SessionSummary, 'session_id'>
  srs_queue!: Table<SrsEntry, [string, Domain]>
  pair_history!: EntityTable<PairHistoryEntry, 'id'>
  streaks!: EntityTable<StreakRecord, 'domain'>
  personal_bests!: EntityTable<PersonalBest, 'domain'>

  constructor() {
    super('KineticTypeDB')
    this.version(1).stores({
      ngram_stats: '[pair_id+domain], domain, [domain+weight_wp], last_updated',
      session_logs: 'session_id, [domain_type+timestamp]',
    })
    // Phase 2: spaced-repetition queue (Backend Schema §02 TABLE: SRS_QUEUE).
    // Dexie only needs the new/changed table listed here — ngram_stats and
    // session_logs carry over unchanged from version 1.
    this.version(2).stores({
      srs_queue: '[pair_id+domain], domain, next_review_at',
    })
    // Phase 3: per-pair latency history for trend sparklines (not in Backend
    // Schema — see PairHistoryEntry in engine/types.ts for why).
    this.version(3).stores({
      pair_history: '++id, [pair_id+domain], timestamp',
    })
    // Streaks & personal bests (not in Backend Schema) — one row per domain,
    // keyed directly by domain since there's exactly one current record each.
    this.version(4).stores({
      streaks: 'domain',
      personal_bests: 'domain',
    })
  }
}

export const db = new KineticTypeDB()
