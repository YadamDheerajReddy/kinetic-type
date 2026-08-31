import { describe, expect, it } from 'vitest'
import { computeAccuracy, computeBurstConsistency, computeNetWpm, computeRawWpm } from './metrics'

describe('computeRawWpm', () => {
  it('computes (chars / 5) / minutes', () => {
    // 250 chars in 60,000ms (1 minute) = 50 words/min
    expect(computeRawWpm(250, 60_000)).toBe(50)
  })

  it('returns 0 for zero or negative elapsed time', () => {
    expect(computeRawWpm(100, 0)).toBe(0)
    expect(computeRawWpm(100, -1)).toBe(0)
  })
})

describe('computeNetWpm', () => {
  it('subtracts the uncorrected-error rate from raw WPM', () => {
    // raw = 50 wpm; 6 errors in 1 minute -> net = 44
    expect(computeNetWpm(250, 6, 60_000)).toBe(44)
  })

  it('never goes negative even with more errors than raw WPM', () => {
    expect(computeNetWpm(50, 100, 60_000)).toBe(0)
  })
})

describe('computeAccuracy', () => {
  it('computes correct / total as a percentage', () => {
    expect(computeAccuracy(98, 100)).toBe(98)
  })

  it('defaults to 100% when nothing has been typed yet', () => {
    expect(computeAccuracy(0, 0)).toBe(100)
  })
})

describe('computeBurstConsistency', () => {
  it('scores a perfectly even cadence near 1', () => {
    const start = 0
    // exactly 10 keystrokes per 5s window, for 4 windows = perfectly even
    const timestamps: number[] = []
    for (let window = 0; window < 4; window++) {
      for (let i = 0; i < 10; i++) {
        timestamps.push(start + window * 5000 + i * 400)
      }
    }
    expect(computeBurstConsistency(timestamps, start)).toBeCloseTo(1, 5)
  })

  it('scores a bursty cadence (one fast window, one empty-ish window) lower', () => {
    const start = 0
    const timestamps = [
      ...Array.from({ length: 40 }, (_, i) => start + i * 100), // window 0: 40 keystrokes
      start + 5000, // window 1: 1 keystroke
    ]
    const score = computeBurstConsistency(timestamps, start)
    expect(score).toBeLessThan(0.5)
  })

  it('returns 1 when there is not enough data to measure variance', () => {
    expect(computeBurstConsistency([], 0)).toBe(1)
    expect(computeBurstConsistency([100, 200, 300], 0)).toBe(1)
  })
})
