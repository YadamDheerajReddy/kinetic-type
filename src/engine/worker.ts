import * as Comlink from 'comlink'
import {
  endSession,
  exportSessionHistory,
  getHeatmapData,
  getHistoryView,
  getNextChunk,
  processBatch,
  resetPairing,
  startSession,
  updateMilestones,
} from './session'
import type { HistoryView, MilestoneResult, NextChunk } from './session'
import type { Domain, HeatmapEntry, KeyEvent, SessionSummary } from './types'
export type { HistoryView, MilestoneResult, NextChunk } from './session'

export interface AdaptiveEngineApi {
  startSession(domain: Domain): Promise<void>
  processBatch(events: KeyEvent[]): Promise<void>
  resetPairing(): Promise<void>
  getNextChunk(minChars: number, mode?: 'adaptive' | 'drill'): Promise<NextChunk>
  endSession(partial: Omit<SessionSummary, 'top_pairs'>): Promise<SessionSummary>
  getHeatmapData(): Promise<HeatmapEntry[]>
  getHistoryView(domain: Domain, sessionLimit?: number): Promise<HistoryView>
  updateMilestones(
    domain: Domain,
    wpmNet: number,
    accuracy: number,
    timestamp: number,
  ): Promise<MilestoneResult>
  exportSessionHistory(domain: Domain): Promise<SessionSummary[]>
}

const api: AdaptiveEngineApi = {
  startSession,
  processBatch,
  resetPairing: async () => resetPairing(),
  getNextChunk,
  endSession,
  getHeatmapData,
  getHistoryView,
  updateMilestones,
  exportSessionHistory,
}

Comlink.expose(api)
