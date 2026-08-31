import * as Comlink from 'comlink'
import { endSession, getNextChunk, processBatch, resetPairing, startSession } from './session'
import type { NextChunk } from './session'
import type { Domain, KeyEvent, SessionSummary } from './types'
export type { NextChunk } from './session'

export interface AdaptiveEngineApi {
  startSession(domain: Domain): Promise<void>
  processBatch(events: KeyEvent[]): Promise<void>
  resetPairing(): Promise<void>
  getNextChunk(minChars: number): Promise<NextChunk>
  endSession(partial: Omit<SessionSummary, 'top_pairs'>): Promise<SessionSummary>
}

const api: AdaptiveEngineApi = {
  startSession,
  processBatch,
  resetPairing: async () => resetPairing(),
  getNextChunk,
  endSession,
}

Comlink.expose(api)
