import 'fake-indexeddb/auto' // must precede the db import — patches globalThis.indexedDB
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { endSession, processBatch, startSession } from './session'
import type { KeyEvent } from './types'

function key(char: string, type: 'down' | 'up', t: number, correct?: boolean): KeyEvent {
  return { code: `Key${char.toUpperCase()}`, char, type, t, domain: 'PROSE', correct }
}

beforeEach(async () => {
  await db.ngram_stats.clear()
  await db.session_logs.clear()
})

describe('session orchestration', () => {
  it('persists ngram_stats updates from processBatch to IndexedDB', async () => {
    await startSession('PROSE')
    await processBatch([
      key('a', 'down', 0, true),
      key('a', 'up', 50, true),
      key('b', 'down', 130, true),
    ])

    const rows = await db.ngram_stats.where('domain').equals('PROSE').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ pair_id: 'a->b', avg_latency_ms: 80, total_occurrences: 1 })
  })

  it('loads prior stats for the domain into the cache on startSession, so EWMA continues across sessions', async () => {
    await db.ngram_stats.put({
      pair_id: 'a->b',
      domain: 'PROSE',
      avg_latency_ms: 100,
      total_occurrences: 5,
      error_count: 0,
      weight_wp: 0,
      last_updated: 0,
    })

    await startSession('PROSE')
    await processBatch([key('a', 'up', 0, true), key('b', 'down', 200, true)]) // transit = 200

    const row = await db.ngram_stats.get(['a->b', 'PROSE'])
    // 0.15 * 200 + 0.85 * 100 = 115, continuing from the persisted average, not resetting to 200
    expect(row?.avg_latency_ms).toBeCloseTo(115)
    expect(row?.total_occurrences).toBe(6)
  })

  it('endSession persists a session_logs row and returns the computed top_pairs', async () => {
    await startSession('PROSE')
    await processBatch([
      key('a', 'up', 0, true),
      key('b', 'down', 200, true), // a->b: 200ms
      key('b', 'up', 210, true),
      key('c', 'down', 215, true), // b->c: 5ms
    ])

    const summary = await endSession({
      session_id: 'test-session-1',
      domain_type: 'PROSE',
      wpm_raw: 40,
      wpm_net: 38,
      accuracy: 97,
      burst_consistency: 0.9,
      timestamp: 12345,
    })

    expect(summary.top_pairs[0]).toEqual({ pair: 'a->b', ms: 200 })

    const persisted = await db.session_logs.get('test-session-1')
    expect(persisted).toMatchObject({ wpm_net: 38, accuracy: 97 })
    expect(persisted?.top_pairs[0]).toEqual({ pair: 'a->b', ms: 200 })
  })
})
