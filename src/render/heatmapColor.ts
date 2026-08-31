import type { HeatmapEntry } from '../engine/types'

// UI/UX Brief §03/§11: colorblind-safe teal->amber ramp, luminance-separated
// (not hue alone) — Signal Teal (#4FD1C5) to Friction Amber (#FF8A5C) in HSL.
const TEAL_HSL = { h: 174, s: 42, l: 61 }
const AMBER_HSL = { h: 14, s: 100, l: 69 }

/** Exported for reuse anywhere else a fast->slow intensity needs the same ramp (e.g. FingerLoadChart). */
export function rampColor(t: number): string {
  const h = TEAL_HSL.h + (AMBER_HSL.h - TEAL_HSL.h) * t
  const s = TEAL_HSL.s + (AMBER_HSL.s - TEAL_HSL.s) * t
  const l = TEAL_HSL.l + (AMBER_HSL.l - TEAL_HSL.l) * t
  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`
}

/**
 * Maps each key with data to a color on the teal(fast)->amber(slow) ramp,
 * scaled relative to this user's own observed range — "amber = slowest
 * decile" (UI/UX Brief §08) is inherently relative, not an absolute ms
 * threshold, since typing speed varies hugely person to person.
 */
export function computeHeatmapColors(entries: readonly HeatmapEntry[]): Map<string, string> {
  const withData = entries.filter((entry) => entry.occurrences > 0)
  if (withData.length === 0) return new Map()

  const values = withData.map((entry) => entry.avgLatencyMs)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const colors = new Map<string, string>()
  for (const entry of withData) {
    colors.set(entry.key, rampColor((entry.avgLatencyMs - min) / range))
  }
  return colors
}
