import type { Domain, PersonalBest, StreakRecord } from './types'

export function todayUtc(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY)
}

/**
 * A session today either starts a new streak, extends yesterday's, resets a
 * broken one, or (a second session on the same day) simply confirms it.
 */
export function updateStreak(
  existing: StreakRecord | undefined,
  domain: Domain,
  today: string,
): StreakRecord {
  if (!existing) {
    return { domain, currentStreak: 1, longestStreak: 1, lastActiveDate: today }
  }

  const gap = daysBetween(existing.lastActiveDate, today)
  if (gap === 0) return existing // already active today, nothing changes
  if (gap < 0) return existing // clock skew / stale write — don't corrupt the record

  const currentStreak = gap === 1 ? existing.currentStreak + 1 : 1
  return {
    domain,
    currentStreak,
    longestStreak: Math.max(existing.longestStreak, currentStreak),
    lastActiveDate: today,
  }
}

export interface BestCheckResult {
  record: PersonalBest
  isNewWpmBest: boolean
  isNewAccuracyBest: boolean
}

/**
 * A brand-new domain's first-ever session just establishes the baseline —
 * it isn't a "personal best" worth celebrating (every session would trivially
 * qualify), so the flags only fire from the second session onward.
 */
export function checkPersonalBest(
  existing: PersonalBest | undefined,
  domain: Domain,
  wpmNet: number,
  accuracy: number,
  now: number,
): BestCheckResult {
  const isNewWpmBest = existing !== undefined && wpmNet > existing.bestWpmNet
  const isNewAccuracyBest = existing !== undefined && accuracy > existing.bestAccuracy

  return {
    record: {
      domain,
      bestWpmNet: Math.max(existing?.bestWpmNet ?? 0, wpmNet),
      bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
      updatedAt: now,
    },
    isNewWpmBest,
    isNewAccuracyBest,
  }
}
