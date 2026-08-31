import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Domain, PairStat, SessionSummary } from '../engine/types'

/**
 * Local-first persistence — Backend Schema §02. IndexedDB is the permanent source
 * of truth on every device; Firestore (Phase 4) is only ever a backup mirror and
 * is never read from to render the app (TRD §01, §06).
 *
 * This runs inside the Adaptive Engine worker, not the main thread — the worker
 * owns the Local Data Tier per the architecture diagram (TRD §01), and IndexedDB
 * is available in a dedicated worker's global scope.
 *
 * Primary key for ngram_stats is [pair_id+domain], not pair_id alone: a pair's
 * stats are tracked independently per domain (Backend Schema §04 cardinality
 * note — "Shift→{" behaves differently in Dev Mode vs. Prose Mode).
 */
export class KineticTypeDB extends Dexie {
  // Compound primary key [pair_id+domain] isn't a single `keyof PairStat`, so this
  // uses the plain Table type instead of EntityTable (which assumes a single key field).
  ngram_stats!: Table<PairStat, [string, Domain]>
  session_logs!: EntityTable<SessionSummary, 'session_id'>

  constructor() {
    super('KineticTypeDB')
    this.version(1).stores({
      ngram_stats: '[pair_id+domain], domain, [domain+weight_wp], last_updated',
      session_logs: 'session_id, [domain_type+timestamp]',
    })
  }
}

export const db = new KineticTypeDB()
