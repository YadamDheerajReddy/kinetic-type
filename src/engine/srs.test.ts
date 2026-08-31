import { describe, expect, it } from 'vitest'
import { isMastered, reconcileSrsEntry, selectDuePairs } from './srs'
import type { PairStat, SrsEntry } from './types'

function stat(overrides: Partial<PairStat> = {}): PairStat {
  return {
    pair_id: 'a->b',
    domain: 'PROSE',
    avg_latency_ms: 50,
    total_occurrences: 10,
    error_count: 0,
    weight_wp: 50,
    last_updated: 0,
    ...overrides,
  }
}

describe('isMastered', () => {
  it('is true once weight drops well below the domain average, with enough occurrences', () => {
    expect(isMastered(stat({ weight_wp: 20, total_occurrences: 10 }), 100)).toBe(true)
  })

  it('is false for a pair that has not been practiced enough yet, even if fast', () => {
    expect(isMastered(stat({ weight_wp: 5, total_occurrences: 2 }), 100)).toBe(false)
  })

  it('is false when the weight is not meaningfully below average', () => {
    expect(isMastered(stat({ weight_wp: 90, total_occurrences: 10 }), 100)).toBe(false)
  })

  it('is false when there is no domain average to compare against yet', () => {
    expect(isMastered(stat({ weight_wp: 1, total_occurrences: 10 }), 0)).toBe(false)
  })
})

describe('reconcileSrsEntry', () => {
  const now = 1_000_000

  it('creates a new stage-0 entry the first time a pair becomes mastered', () => {
    const entry = reconcileSrsEntry(stat({ weight_wp: 10 }), undefined, 100, now)
    expect(entry).toMatchObject({ pair_id: 'a->b', domain: 'PROSE', review_stage: 0 })
    expect(entry?.next_review_at).toBeGreaterThan(now)
  })

  it('advances the stage and pushes the review further out on a repeat success', () => {
    const existing: SrsEntry = {
      pair_id: 'a->b',
      domain: 'PROSE',
      mastered_at: 0,
      review_stage: 1,
      next_review_at: 500,
    }
    const entry = reconcileSrsEntry(stat({ weight_wp: 10 }), existing, 100, now)
    expect(entry?.review_stage).toBe(2)
    expect(entry?.next_review_at).toBeGreaterThan(existing.next_review_at)
  })

  it('caps the stage at the maximum interval instead of growing forever', () => {
    const existing: SrsEntry = {
      pair_id: 'a->b',
      domain: 'PROSE',
      mastered_at: 0,
      review_stage: 5,
      next_review_at: 500,
    }
    const entry = reconcileSrsEntry(stat({ weight_wp: 10 }), existing, 100, now)
    expect(entry?.review_stage).toBe(5)
  })

  it('drops the entry when a previously-mastered pair regresses', () => {
    const existing: SrsEntry = {
      pair_id: 'a->b',
      domain: 'PROSE',
      mastered_at: 0,
      review_stage: 2,
      next_review_at: 500,
    }
    const entry = reconcileSrsEntry(stat({ weight_wp: 95 }), existing, 100, now)
    expect(entry).toBeNull()
  })

  it('returns null for a pair that was never mastered and has no entry', () => {
    expect(reconcileSrsEntry(stat({ weight_wp: 95 }), undefined, 100, now)).toBeNull()
  })
})

describe('selectDuePairs', () => {
  it('returns only entries whose next_review_at has arrived', () => {
    const entries: SrsEntry[] = [
      { pair_id: 'a->b', domain: 'PROSE', mastered_at: 0, review_stage: 0, next_review_at: 100 },
      { pair_id: 'c->d', domain: 'PROSE', mastered_at: 0, review_stage: 0, next_review_at: 900 },
    ]
    expect(selectDuePairs(entries, 500).map((e) => e.pair_id)).toEqual(['a->b'])
  })
})
