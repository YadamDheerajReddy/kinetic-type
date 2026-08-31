import { describe, expect, it } from 'vitest'
import { computeTopPairs, initialMatrixState, processKeyEventBatch } from './ngramMatrix'
import type { KeyEvent } from './types'

function key(char: string, type: 'down' | 'up', t: number, correct?: boolean): KeyEvent {
  return { code: `Key${char.toUpperCase()}`, char, type, t, domain: 'PROSE', correct }
}

describe('processKeyEventBatch', () => {
  it('computes transit time as keydown(k2) - keyup(k1), not keydown-to-keydown', () => {
    const events = [
      key('a', 'down', 0, true),
      key('a', 'up', 50, true),
      key('b', 'down', 120, true),
    ]

    const { updatedStats } = processKeyEventBatch(events, initialMatrixState, new Map())

    expect(updatedStats).toHaveLength(1)
    expect(updatedStats[0]).toMatchObject({
      pair_id: 'a->b',
      avg_latency_ms: 70, // 120 - 50, NOT 120 - 0
      total_occurrences: 1,
      error_count: 0,
    })
  })

  it('applies an EWMA update (lambda=0.15) on repeat occurrences of the same pair', () => {
    const existing = new Map([
      [
        'a->b',
        {
          pair_id: 'a->b',
          domain: 'PROSE' as const,
          avg_latency_ms: 100,
          total_occurrences: 1,
          error_count: 0,
          weight_wp: 0,
          last_updated: 0,
        },
      ],
    ])
    const events = [key('a', 'up', 0, true), key('b', 'down', 200, true)] // transit = 200

    const { updatedStats } = processKeyEventBatch(events, initialMatrixState, existing)

    // 0.15 * 200 + 0.85 * 100 = 115
    expect(updatedStats[0].avg_latency_ms).toBeCloseTo(115)
    expect(updatedStats[0].total_occurrences).toBe(2)
  })

  it('counts an incorrect keystroke as an error on that pair', () => {
    const events = [key('a', 'up', 0, true), key('b', 'down', 50, false)]

    const { updatedStats } = processKeyEventBatch(events, initialMatrixState, new Map())

    expect(updatedStats[0].error_count).toBe(1)
  })

  it('carries lastKeyUp state across batches so a pair split across a batch boundary still counts', () => {
    const batch1 = [key('a', 'down', 0, true), key('a', 'up', 50, true)]
    const { state } = processKeyEventBatch(batch1, initialMatrixState, new Map())

    const batch2 = [key('b', 'down', 130, true)]
    const { updatedStats } = processKeyEventBatch(batch2, state, new Map())

    expect(updatedStats).toHaveLength(1)
    expect(updatedStats[0].pair_id).toBe('a->b')
    expect(updatedStats[0].avg_latency_ms).toBe(80) // 130 - 50
  })

  it('ignores non-printable events (e.g. modifier-only keys) when forming pairs', () => {
    const events = [
      key('a', 'up', 0, true),
      { code: 'ShiftLeft', char: 'Shift', type: 'down' as const, t: 30, domain: 'PROSE' as const },
      key('b', 'down', 80, true),
    ]

    const { updatedStats } = processKeyEventBatch(events, initialMatrixState, new Map())

    expect(updatedStats).toHaveLength(1)
    expect(updatedStats[0].pair_id).toBe('a->b')
  })
})

describe('computeTopPairs', () => {
  it('ranks pairs by average session-local latency, descending, capped to the limit', () => {
    const samples = [
      { pairId: 'a->b', ms: 50 },
      { pairId: 'a->b', ms: 70 }, // avg 60
      { pairId: 'e->r', ms: 200 }, // avg 200 -> slowest
      { pairId: 't->h', ms: 10 }, // avg 10 -> fastest
    ]

    const top = computeTopPairs(samples, 2)

    expect(top).toEqual([
      { pair: 'e->r', ms: 200 },
      { pair: 'a->b', ms: 60 },
    ])
  })

  it('returns an empty list for a session with no measured transitions', () => {
    expect(computeTopPairs([], 5)).toEqual([])
  })
})
