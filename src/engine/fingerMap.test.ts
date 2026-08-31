import { describe, expect, it } from 'vitest'
import { computeFingerLoads } from './fingerMap'

describe('computeFingerLoads', () => {
  it('aggregates multiple keys onto the same finger, weighted by occurrences', () => {
    // e and d and c all map to "Left middle"
    const loads = computeFingerLoads([
      { key: 'e', avgLatencyMs: 100, occurrences: 10 },
      { key: 'd', avgLatencyMs: 200, occurrences: 10 },
    ])

    const leftMiddle = loads.find((l) => l.finger === 'Left middle')
    expect(leftMiddle?.occurrences).toBe(20)
    expect(leftMiddle?.avgLatencyMs).toBeCloseTo(150) // equal weight -> simple average
  })

  it('excludes fingers with no typed keys', () => {
    const loads = computeFingerLoads([{ key: 'q', avgLatencyMs: 50, occurrences: 5 }])
    expect(loads.map((l) => l.finger)).toEqual(['Left pinky'])
  })

  it('ignores keys with zero occurrences', () => {
    const loads = computeFingerLoads([{ key: 'q', avgLatencyMs: 0, occurrences: 0 }])
    expect(loads).toEqual([])
  })

  it('returns fingers in a stable left-to-right hand order', () => {
    const loads = computeFingerLoads([
      { key: 'p', avgLatencyMs: 10, occurrences: 1 }, // right pinky
      { key: 'q', avgLatencyMs: 10, occurrences: 1 }, // left pinky
    ])
    expect(loads.map((l) => l.finger)).toEqual(['Left pinky', 'Right pinky'])
  })
})
