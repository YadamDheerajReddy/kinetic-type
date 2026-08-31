import * as Comlink from 'comlink'
import { endSession, processBatch, resetPairing, startSession } from './session'
import type { Domain, KeyEvent, SessionSummary } from './types'

export interface AdaptiveEngineApi {
  startSession(domain: Domain): Promise<void>
  processBatch(events: KeyEvent[]): Promise<void>
  resetPairing(): Promise<void>
  endSession(partial: Omit<SessionSummary, 'top_pairs'>): Promise<SessionSummary>
}

const api: AdaptiveEngineApi = {
  startSession,
  processBatch,
  resetPairing: async () => resetPairing(),
  endSession,
}

Comlink.expose(api)
