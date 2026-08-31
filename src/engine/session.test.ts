import 'fake-indexeddb/auto' // must precede the db import — patches globalThis.indexedDB
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { endSession, getNextChunk, processBatch, startSession } from './session'
import type { KeyEvent } from './types'

function key(char: string, type: 'down' | 'up', t: number, correct?: boolean): KeyEvent {
  return { code: `Key${char.toUpperCase()}`, char, type, t, domain: 'PROSE', correct }
}

beforeEach(async () => {
  await db.ngram_stats.clear()
  await db.session_logs.clear()
  await db.srs_queue.clear()
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

  it('getNextChunk falls back to plain flow text before any pairs are weighted', async () => {
    await startSession('PROSE')
    const { text, targetedPair } = await getNextChunk(100)

    expect(text.length).toBeGreaterThanOrEqual(100)
    expect(targetedPair).toBeNull()
  })

  it('getNextChunk reports the current top-weighted pair once one exists', async () => {
    await startSession('PROSE')
    // repeatedly transit a->b slowly and with errors so it becomes clearly weighted
    for (let i = 0; i < 5; i++) {
      const base = i * 1000
      await processBatch([
        key('a', 'up', base, true),
        key('b', 'down', base + 300, false), // slow (300ms) and wrong
      ])
    }

    const { targetedPair } = await getNextChunk(100)
    expect(targetedPair).toBe('a->b')
  })

  it('promotes a pair to srs_queue once it is mastered, persisted to IndexedDB', async () => {
    await startSession('PROSE')
    // one slow/erroring pair establishes a high domain average...
    await processBatch([key('x', 'up', 0, false), key('y', 'down', 500, false)])
    // ...then a different pair typed consistently fast and correctly should master out
    // once it clears the MASTERY_OCCURRENCE_FLOOR (5 occurrences) — stop right there so
    // the entry is freshly created at stage 0, not yet advanced by a later repeat.
    for (let i = 1; i <= 5; i++) {
      const base = i * 1000
      await processBatch([key('a', 'up', base, true), key('b', 'down', base + 10, true)])
    }

    const entry = await db.srs_queue.get(['a->b', 'PROSE'])
    expect(entry).toBeDefined()
    expect(entry?.review_stage).toBe(0)

    // one more successful encounter (the natural next repeat) should advance the stage
    await processBatch([key('a', 'up', 6000, true), key('b', 'down', 6010, true)])
    const advanced = await db.srs_queue.get(['a->b', 'PROSE'])
    expect(advanced?.review_stage).toBe(1)
  })
})
