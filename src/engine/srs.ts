import type { PairStat, SrsEntry } from './types'

// Spaced-repetition interval per stage, in days — doubling-ish, standard SRS
// convention. Backend Schema §02: srs_queue.review_stage is 0-5.
const INTERVAL_DAYS = [1, 3, 7, 14, 30, 90]
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_STAGE = INTERVAL_DAYS.length - 1

// A pair needs to have actually been practiced enough to trust its stats
// before calling it "mastered" — otherwise a pair typed twice and both times
// fast would immediately qualify on noise alone.
const MASTERY_OCCURRENCE_FLOOR = 5

/**
 * "Mastered" = no longer one of the pairs actively worth targeting: seen
 * enough times, and its current weight has dropped well below the domain's
 * average (i.e. it's fallen out of the top of the targeting queue).
 */
export function isMastered(stat: PairStat, domainAverageWeight: number): boolean {
  if (stat.total_occurrences < MASTERY_OCCURRENCE_FLOOR) return false
  if (domainAverageWeight <= 0) return false
  return stat.weight_wp < domainAverageWeight * 0.5
}

/**
 * Reconciles one pair's SRS entry against its latest stats (TRD §04 step 4:
 * "pairs mastered < 3 sessions ago are re-inserted at low density to confirm
 * retention"). Called every time a pair's ngram_stats row updates.
 *
 * - Newly mastered, no entry yet -> create one at stage 0.
 * - Has an entry and still mastered -> advance a stage and push the next
 *   review further out (a successful recall, whether the encounter came from
 *   deliberate low-density reinsertion or just normal flow text).
 * - Has an entry but regressed (no longer mastered) -> drop it; it falls
 *   back into the normal weighted-targeting pool instead of the review queue.
 * - Not mastered, no entry -> nothing to do (returns null either way).
 */
export function reconcileSrsEntry(
  stat: PairStat,
  existing: SrsEntry | undefined,
  domainAverageWeight: number,
  now: number,
): SrsEntry | null {
  if (!isMastered(stat, domainAverageWeight)) return null

  if (!existing) {
    return {
      pair_id: stat.pair_id,
      domain: stat.domain,
      mastered_at: now,
      review_stage: 0,
      next_review_at: now + INTERVAL_DAYS[0] * DAY_MS,
    }
  }

  const nextStage = Math.min(MAX_STAGE, existing.review_stage + 1)
  return {
    ...existing,
    review_stage: nextStage,
    next_review_at: now + INTERVAL_DAYS[nextStage] * DAY_MS,
  }
}

export function selectDuePairs(entries: SrsEntry[], now: number): SrsEntry[] {
  return entries.filter((entry) => entry.next_review_at <= now)
}
