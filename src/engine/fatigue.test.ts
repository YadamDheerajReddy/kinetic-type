import { describe, expect, it } from 'vitest'
import { detectMicroPauses } from './fatigue'

function evenlySpaced(count: number, gapMs: number, start = 0): number[] {
  return Array.from({ length: count }, (_, i) => start + i * gapMs)
}

// A seeded PRNG so the "realistic typing" fixture below is reproducible.
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

/**
 * Simulates 300 keystrokes of plausible real typing: mostly fast within-word
 * gaps (60-140ms), a word boundary roughly every 5 keys (180-280ms — slower,
 * but not a "pause"), and exactly `pauseCount` genuine hesitations dropped in.
 */
function realisticSession(pauseCount: number): number[] {
  const random = mulberry32(7)
  const timestamps = [0]
  let t = 0
  for (let i = 0; i < 300; i++) {
    const isWordBoundary = i % 5 === 0 && i > 0
    t += isWordBoundary ? 180 + random() * 100 : 60 + random() * 80
    timestamps.push(t)
  }
  for (let p = 0; p < pauseCount; p++) {
    const insertAt = 20 + p * 40
    for (let i = insertAt; i < timestamps.length; i++) timestamps[i] += 2000
  }
  return timestamps
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

  it('returns nothing for too little data to judge (fewer than 10 keystrokes)', () => {
    expect(detectMicroPauses(evenlySpaced(9, 150))).toEqual([])
    expect(detectMicroPauses([])).toEqual([])
  })

  it('does not flag normal gaps just because typing is generally slow', () => {
    // a consistently slow-but-steady typist shouldn't be flagged for every keystroke
    expect(detectMicroPauses(evenlySpaced(20, 600))).toEqual([])
  })

  it('does not mistake ordinary word-boundary friction for hesitation', () => {
    // Regression test: an earlier median+MAD threshold flagged ~15% of gaps
    // in a session like this (every word boundary), instead of just real
    // outliers. With zero deliberate pauses inserted, nothing should fire.
    const pauses = detectMicroPauses(realisticSession(0))
    expect(pauses).toEqual([])
  })

  it('still finds genuine hesitations against a realistic, uneven baseline rhythm', () => {
    const pauses = detectMicroPauses(realisticSession(3))
    expect(pauses).toHaveLength(3)
    for (const pause of pauses) {
      expect(pause.gapMs).toBeGreaterThan(1900)
    }
  })
})
