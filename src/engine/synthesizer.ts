import type { PairStat } from './types'

// TRD §04 Text Selection Protocol: 70% targeted high-weight tokens, 30% contextual flow.
const TARGET_WORD_RATIO = 0.7
// TRD §04 step 4: spaced-repetition gate re-inserts recently-mastered pairs at low density.
const REVIEW_INSERTION_CHANCE = 0.08
const TOP_PAIR_COUNT = 8
const WORD_GAP = 1 // one space between words, for length accounting

export interface SynthesizeInput {
  words: readonly string[]
  weightedPairs: readonly PairStat[]
  dueSrsPairIds: readonly string[]
  targetLength: number
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number
}

function pairSubstring(pairId: string): string {
  const [a, b] = pairId.split('->')
  return `${a}${b}`
}

function wordsContainingPair(words: readonly string[], pairId: string): string[] {
  const substring = pairSubstring(pairId)
  return words.filter((word) => word.includes(substring))
}

/**
 * TRD §04 Text Selection Protocol, steps 1-4. Assembles upcoming practice text
 * by over-weighting words that exercise the user's slowest/error-prone key
 * pairs. With no weighted pairs yet (first-ever session, empty matrix), this
 * degrades gracefully to plain flow text — identical in spirit to Phase 1's
 * sequential streaming, just word-sampled instead.
 */
export function synthesizeText(input: SynthesizeInput): string {
  const { words, weightedPairs, dueSrsPairIds, targetLength } = input
  const random = input.random ?? Math.random

  if (words.length === 0) return ''

  const topPairs = [...weightedPairs]
    .filter((pair) => pair.weight_wp > 0)
    .sort((a, b) => b.weight_wp - a.weight_wp)
    .slice(0, TOP_PAIR_COUNT)

  const targetedPool = topPairs.flatMap((pair) => wordsContainingPair(words, pair.pair_id))
  const reviewPool = dueSrsPairIds.flatMap((pairId) => wordsContainingPair(words, pairId))

  const chosen: string[] = []
  let length = 0

  while (length < targetLength) {
    let pool: readonly string[] = words
    const roll = random()

    if (reviewPool.length > 0 && roll < REVIEW_INSERTION_CHANCE) {
      pool = reviewPool
    } else if (targetedPool.length > 0 && roll < TARGET_WORD_RATIO) {
      pool = targetedPool
    }

    const word = pool[Math.floor(random() * pool.length)]
    chosen.push(word)
    length += word.length + WORD_GAP
  }

  return chosen.join(' ')
}
