import * as Comlink from 'comlink'
import {
  endSession,
  getHeatmapData,
  getHistoryView,
  getNextChunk,
  processBatch,
  resetPairing,
  startSession,
} from './session'
import type { HistoryView, NextChunk } from './session'
import type { Domain, HeatmapEntry, KeyEvent, SessionSummary } from './types'
export type { HistoryView, NextChunk } from './session'

export interface AdaptiveEngineApi {
  startSession(domain: Domain): Promise<void>
  processBatch(events: KeyEvent[]): Promise<void>
  resetPairing(): Promise<void>
  getNextChunk(minChars: number): Promise<NextChunk>
  endSession(partial: Omit<SessionSummary, 'top_pairs'>): Promise<SessionSummary>
  getHeatmapData(): Promise<HeatmapEntry[]>
  getHistoryView(domain: Domain, sessionLimit?: number): Promise<HistoryView>
}

const api: AdaptiveEngineApi = {
  startSession,
  processBatch,
  resetPairing: async () => resetPairing(),
  getNextChunk,
  endSession,
  getHeatmapData,
  getHistoryView,
}

Comlink.expose(api)
