// Core session metrics — Implementation Plan §03 "Core metrics" workstream,
// PRD FR-06. Pure functions, unit tested against fixed fixtures per plan.

const WORD_LENGTH = 5 // standard typing-test convention: 5 chars = 1 "word"

export function computeRawWpm(totalCharsTyped: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60_000
  return totalCharsTyped / WORD_LENGTH / minutes
}

/**
 * Net WPM: gross WPM minus the rate of uncorrected errors, per the standard
 * typing-test convention (glossary: "Words-per-minute adjusted for
 * uncorrected errors"). Never negative.
 */
export function computeNetWpm(
  totalCharsTyped: number,
  uncorrectedErrors: number,
  elapsedMs: number,
): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60_000
  const raw = computeRawWpm(totalCharsTyped, elapsedMs)
  return Math.max(0, raw - uncorrectedErrors / minutes)
}

export function computeAccuracy(correctChars: number, totalCharsTyped: number): number {
  if (totalCharsTyped <= 0) return 100
  return (correctChars / totalCharsTyped) * 100
}

const BURST_WINDOW_MS = 5000

/**
 * Burst-consistency score (session_logs.burst_consistency, Backend Schema
 * §02): how even the typist's speed was across 5-second windows, as
 * 1 - coefficient of variation, clamped to [0, 1]. 1 = perfectly steady,
 * 0 = wildly uneven. Needs at least two windows to be meaningful; shorter
 * sessions return 1 (nothing to measure inconsistency against).
 */
export function computeBurstConsistency(
  keystrokeTimestamps: number[],
  sessionStart: number,
): number {
  if (keystrokeTimestamps.length === 0) return 1

  const windowCounts = new Map<number, number>()
  for (const t of keystrokeTimestamps) {
    const windowIndex = Math.floor((t - sessionStart) / BURST_WINDOW_MS)
    windowCounts.set(windowIndex, (windowCounts.get(windowIndex) ?? 0) + 1)
  }

  const counts = [...windowCounts.values()]
  if (counts.length < 2) return 1

  const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length
  if (mean === 0) return 1

  const variance = counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length
  const coefficientOfVariation = Math.sqrt(variance) / mean

  return Math.max(0, Math.min(1, 1 - coefficientOfVariation))
}
