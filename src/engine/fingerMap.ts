import type { HeatmapEntry } from './types'

// Standard touch-typing finger assignment for the QWERTY home layout used
// throughout the app (KeyboardHeatmap's three letter rows + space).
export const FINGER_MAP: Record<string, string> = {
  q: 'Left pinky',
  a: 'Left pinky',
  z: 'Left pinky',
  w: 'Left ring',
  s: 'Left ring',
  x: 'Left ring',
  e: 'Left middle',
  d: 'Left middle',
  c: 'Left middle',
  r: 'Left index',
  f: 'Left index',
  v: 'Left index',
  t: 'Left index',
  g: 'Left index',
  b: 'Left index',
  y: 'Right index',
  h: 'Right index',
  n: 'Right index',
  u: 'Right index',
  j: 'Right index',
  m: 'Right index',
  i: 'Right middle',
  k: 'Right middle',
  o: 'Right ring',
  l: 'Right ring',
  p: 'Right pinky',
  ' ': 'Thumbs',
}

export const FINGER_ORDER = [
  'Left pinky',
  'Left ring',
  'Left middle',
  'Left index',
  'Thumbs',
  'Right index',
  'Right middle',
  'Right ring',
  'Right pinky',
]

export interface FingerLoad {
  finger: string
  avgLatencyMs: number
  occurrences: number
}

/**
 * Reduces the per-key heatmap down to per-finger load — a more actionable
 * diagnosis than "the T key is slow": "your left index finger is your
 * bottleneck" points at an actual biomechanical habit to work on.
 */
export function computeFingerLoads(entries: readonly HeatmapEntry[]): FingerLoad[] {
  const byFinger = new Map<string, { weightedSum: number; occurrences: number }>()

  for (const entry of entries) {
    if (entry.occurrences === 0) continue
    const finger = FINGER_MAP[entry.key]
    if (!finger) continue
    const bucket = byFinger.get(finger) ?? { weightedSum: 0, occurrences: 0 }
    bucket.weightedSum += entry.avgLatencyMs * entry.occurrences
    bucket.occurrences += entry.occurrences
    byFinger.set(finger, bucket)
  }

  return FINGER_ORDER.filter((finger) => byFinger.has(finger)).map((finger) => {
    const { weightedSum, occurrences } = byFinger.get(finger)!
    return { finger, avgLatencyMs: weightedSum / occurrences, occurrences }
  })
}
