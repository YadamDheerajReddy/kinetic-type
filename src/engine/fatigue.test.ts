import { describe, expect, it } from 'vitest'
import { detectMicroPauses } from './fatigue'

function evenlySpaced(count: number, gapMs: number, start = 0): number[] {
  return Array.from({ length: count }, (_, i) => start + i * gapMs)
}

describe('detectMicroPauses', () => {
  it('finds nothing in a perfectly steady rhythm', () => {
    expect(detectMicroPauses(evenlySpaced(30, 150))).toEqual([])
  })

  it('flags a single anomalous gap dropped into an otherwise steady rhythm', () => {
    const timestamps = evenlySpaced(15, 150)
    // insert a 2-second hesitation after the 8th keystroke
    const withPause = [...timestamps.slice(0, 8), ...timestamps.slice(8).map((t) => t + 2000)]

    const pauses = detectMicroPauses(withPause)

    expect(pauses).toHaveLength(1)
    expect(pauses[0].gapMs).toBeGreaterThan(1900)
  })

  it('returns nothing for too little data to judge (fewer than 3 keystrokes)', () => {
    expect(detectMicroPauses([0, 150])).toEqual([])
    expect(detectMicroPauses([])).toEqual([])
  })

  it('does not flag normal gaps just because typing is generally slow', () => {
    // a consistently slow-but-steady typist shouldn't be flagged for every keystroke
    expect(detectMicroPauses(evenlySpaced(20, 600))).toEqual([])
  })
})
