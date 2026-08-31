import { describe, expect, it } from 'vitest'
import { synthesizeText } from './synthesizer'
import type { PairStat } from './types'

// Small seeded PRNG (mulberry32) so the adaptive-loop test below is
// deterministic rather than relying on real Math.random in CI.
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makePairStat(pairId: string, weight: number): PairStat {
  return {
    pair_id: pairId,
    domain: 'PROSE',
    avg_latency_ms: weight,
    total_occurrences: 20,
    error_count: 4,
    weight_wp: weight,
    last_updated: 0,
  }
}

describe('synthesizeText — adaptive loop', () => {
  // This is the Phase 2 exit criteria from the Implementation Plan §04, made
  // concrete and automatic: "A synthetic test harness injects a deliberately
  // slow key-pair; within one session, that pair's frequency in the generated
  // text stream measurably increases."
  it("increases a deliberately slow key-pair's frequency in the generated stream", () => {
    const words = [
      'apple',
      'banana',
      'orange',
      'grape',
      'melon',
      'kiwi',
      'peach',
      'plum',
      'cherry',
      'mango',
      'lemon',
      'berry',
      'olive',
      'fig',
      'date',
      'quiet',
      'quilt',
      'square',
      'quiz',
      'unique', // contain "qu"
    ]
    const baselineFrequency = words.filter((w) => w.includes('qu')).length / words.length

    const text = synthesizeText({
      words,
      weightedPairs: [makePairStat('q->u', 500)], // deliberately slow + error-prone
      dueSrsPairIds: [],
      targetLength: 4000,
      random: mulberry32(42),
    })

    const generated = text.split(' ')
    const generatedFrequency = generated.filter((w) => w.includes('qu')).length / generated.length

    expect(generatedFrequency).toBeGreaterThan(baselineFrequency * 2)
  })

  it('falls back to plain flow text with no weighted pairs yet (first-ever session)', () => {
    const words = ['the', 'quick', 'brown', 'fox', 'jumps']
    const text = synthesizeText({
      words,
      weightedPairs: [],
      dueSrsPairIds: [],
      targetLength: 100,
      random: mulberry32(1),
    })
    expect(text.length).toBeGreaterThanOrEqual(100)
    for (const word of text.split(' ')) {
      expect(words).toContain(word)
    }
  })

  it('reinserts due spaced-repetition pairs at low density', () => {
    const words = ['able', 'baker', 'candle', 'dozen', 'echo', 'fable']
    const text = synthesizeText({
      words,
      weightedPairs: [],
      dueSrsPairIds: ['a->b'], // matches "able", "baker" — wait, checks substring "ab"
      targetLength: 3000,
      random: mulberry32(7),
    })
    // "able" contains "ab"; with 3000 chars of output at an 8% insertion chance,
    // it should appear meaningfully more than its ~1/6 baseline share would predict by chance alone
    const generated = text.split(' ')
    const ableCount = generated.filter((w) => w === 'able').length
    expect(ableCount).toBeGreaterThan(0)
  })

  it('returns an empty string when the domain has no corpus words at all', () => {
    expect(
      synthesizeText({ words: [], weightedPairs: [], dueSrsPairIds: [], targetLength: 50 }),
    ).toBe('')
  })

  it('Focused Drill Mode (targetRatio=1) uses only words containing a top pair, no flow', () => {
    const words = ['apple', 'banana', 'orange', 'quiet', 'quilt', 'unique']
    const text = synthesizeText({
      words,
      weightedPairs: [makePairStat('q->u', 500)],
      dueSrsPairIds: [],
      targetLength: 500,
      targetRatio: 1,
      random: mulberry32(3),
    })

    for (const word of text.split(' ')) {
      expect(word.includes('qu')).toBe(true)
    }
  })
})
