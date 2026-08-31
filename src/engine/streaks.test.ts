import { describe, expect, it } from 'vitest'
import { checkPersonalBest, todayUtc, updateStreak } from './streaks'

describe('updateStreak', () => {
  it('starts a fresh streak at 1 on the very first session', () => {
    const record = updateStreak(undefined, 'PROSE', '2026-08-31')
    expect(record).toEqual({
      domain: 'PROSE',
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: '2026-08-31',
    })
  })

  it('extends the streak by 1 on the very next calendar day', () => {
    const existing = {
      domain: 'PROSE' as const,
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: '2026-08-30',
    }
    const record = updateStreak(existing, 'PROSE', '2026-08-31')
    expect(record.currentStreak).toBe(4)
    expect(record.longestStreak).toBe(5) // unchanged, previous record still higher
  })

  it('raises longestStreak once currentStreak beats it', () => {
    const existing = {
      domain: 'PROSE' as const,
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: '2026-08-30',
    }
    const record = updateStreak(existing, 'PROSE', '2026-08-31')
    expect(record.currentStreak).toBe(6)
    expect(record.longestStreak).toBe(6)
  })

  it('resets to 1 after a gap of more than one day', () => {
    const existing = {
      domain: 'PROSE' as const,
      currentStreak: 10,
      longestStreak: 10,
      lastActiveDate: '2026-08-20',
    }
    const record = updateStreak(existing, 'PROSE', '2026-08-31')
    expect(record.currentStreak).toBe(1)
    expect(record.longestStreak).toBe(10) // longest record survives a broken streak
  })

  it('leaves the record unchanged for a second session on the same day', () => {
    const existing = {
      domain: 'PROSE' as const,
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: '2026-08-31',
    }
    const record = updateStreak(existing, 'PROSE', '2026-08-31')
    expect(record).toEqual(existing)
  })
})

describe('checkPersonalBest', () => {
  it('does not flag a new best on the very first session (just a baseline)', () => {
    const { isNewWpmBest, isNewAccuracyBest } = checkPersonalBest(undefined, 'PROSE', 80, 95, 1000)
    expect(isNewWpmBest).toBe(false)
    expect(isNewAccuracyBest).toBe(false)
  })

  it('flags a new WPM best only when it actually beats the prior one', () => {
    const existing = { domain: 'PROSE' as const, bestWpmNet: 80, bestAccuracy: 95, updatedAt: 0 }
    const better = checkPersonalBest(existing, 'PROSE', 85, 90, 1000)
    expect(better.isNewWpmBest).toBe(true)
    expect(better.isNewAccuracyBest).toBe(false)
    expect(better.record.bestWpmNet).toBe(85)
    expect(better.record.bestAccuracy).toBe(95) // preserved, not overwritten by a worse session
  })
})

describe('todayUtc', () => {
  it('formats a timestamp as YYYY-MM-DD', () => {
    expect(todayUtc(Date.UTC(2026, 7, 31, 12, 0, 0))).toBe('2026-08-31')
  })
})
