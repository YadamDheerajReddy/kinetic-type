import type { EchoResult, KeyEvent } from './types'

/**
 * Phase 0 architecture spike (Implementation Plan §02): the worker's only job right now
 * is to prove the capture -> worker -> paint pipeline holds together end-to-end. The real
 * n-gram latency matrix and W(P) weighting (TRD §03-04) land in Phase 1/2.
 *
 * Kept as a pure function, separate from worker.ts, so it's testable without spinning up
 * an actual Worker thread.
 */
export function echoKeyEvent(event: KeyEvent, receivedAt: number): EchoResult {
  return {
    event,
    workerReceivedAt: receivedAt,
  }
}
