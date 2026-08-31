// Shared main-thread <-> worker contract. Mirrors TRD §03 (KeyEvent) and §07 (Interface Contracts).
// Domain lexers beyond PROSE arrive in Phase 1 (Implementation Plan §03).
export type Domain = 'CODE_TS' | 'CLI_BASH' | 'PROSE'

export interface KeyEvent {
  code: string
  char: string
  type: 'down' | 'up'
  t: number // performance.now() timestamp, captured on the main thread at input time
  domain: Domain
}

export interface EchoResult {
  event: KeyEvent
  // Worker-clock timestamp — NOT comparable to main-thread performance.now() values.
  // A dedicated worker has its own performance.timeOrigin (worker creation time), so
  // subtracting a main-thread t from this would silently produce nonsense deltas.
  // Round-trip latency must be measured entirely on the main thread's own clock.
  workerReceivedAt: number
}
