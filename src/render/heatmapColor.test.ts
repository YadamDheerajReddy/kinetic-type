import { describe, expect, it } from 'vitest'
import { computeHeatmapColors } from './heatmapColor'
import type { HeatmapEntry } from '../engine/types'

describe('computeHeatmapColors', () => {
  it('maps the fastest key toward teal and the slowest toward amber', () => {
    const entries: HeatmapEntry[] = [
      { key: 'a', avgLatencyMs: 50, occurrences: 10 },
      { key: 'b', avgLatencyMs: 300, occurrences: 10 },
    ]
    const colors = computeHeatmapColors(entries)

    // teal hue ~174, amber hue ~14 — fastest key should be much closer to teal's hue
    const hueOf = (hsl: string) => Number(hsl.match(/hsl\(([\d.]+)/)?.[1])
    expect(hueOf(colors.get('a')!)).toBeGreaterThan(150)
    expect(hueOf(colors.get('b')!)).toBeLessThan(30)
  })

  it('excludes keys with no occurrences yet', () => {
    const entries: HeatmapEntry[] = [
      { key: 'a', avgLatencyMs: 50, occurrences: 10 },
      { key: 'z', avgLatencyMs: 0, occurrences: 0 },
    ]
    const colors = computeHeatmapColors(entries)
    expect(colors.has('z')).toBe(false)
    expect(colors.has('a')).toBe(true)
  })

  it('returns an empty map when nothing has data yet', () => {
    expect(computeHeatmapColors([]).size).toBe(0)
  })

  it('handles a single data point without dividing by zero', () => {
    const colors = computeHeatmapColors([{ key: 'a', avgLatencyMs: 100, occurrences: 5 }])
    expect(colors.get('a')).toBeDefined()
  })
})
