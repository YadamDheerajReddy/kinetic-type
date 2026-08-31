import { describe, expect, it } from 'vitest'
import { computeErrorRate, computeWeight } from './weighting'

describe('computeErrorRate', () => {
  it('computes error_count / total_occurrences', () => {
    expect(computeErrorRate({ error_count: 3, total_occurrences: 12 })).toBeCloseTo(0.25)
  })

  it('returns 0 when there are no occurrences yet', () => {
    expect(computeErrorRate({ error_count: 0, total_occurrences: 0 })).toBe(0)
  })
})

describe('computeWeight', () => {
  it('matches W(P) = L(P) x (1 + alpha x E(P)) exactly, TRD §04', () => {
    // L=100ms, E=0.2 (2/10), alpha=2.5 -> 100 * (1 + 2.5*0.2) = 150
    const weight = computeWeight(
      { avg_latency_ms: 100, error_count: 2, total_occurrences: 10 },
      2.5,
    )
    expect(weight).toBeCloseTo(150)
  })

  it('a pair with a higher error rate weighs more than an equally-slow, cleaner pair', () => {
    const clean = computeWeight({ avg_latency_ms: 100, error_count: 0, total_occurrences: 10 })
    const errorProne = computeWeight({ avg_latency_ms: 100, error_count: 5, total_occurrences: 10 })
    expect(errorProne).toBeGreaterThan(clean)
  })

  it('a slower pair weighs more than a faster pair with the same error rate', () => {
    const fast = computeWeight({ avg_latency_ms: 50, error_count: 1, total_occurrences: 10 })
    const slow = computeWeight({ avg_latency_ms: 200, error_count: 1, total_occurrences: 10 })
    expect(slow).toBeGreaterThan(fast)
  })
})
