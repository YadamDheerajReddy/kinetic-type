import * as Comlink from 'comlink'
import { useEffect, useRef, useState } from 'react'
import type { AdaptiveEngineApi } from './worker'

/**
 * Owns the Adaptive Engine worker for the lifetime of the app, not per-session —
 * spinning up a fresh Worker on every "Start Session" click would be wasteful and
 * would lose the in-memory ngram_stats cache session.ts builds up.
 */
export function useAdaptiveEngine() {
  const apiRef = useRef<Comlink.Remote<AdaptiveEngineApi> | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    apiRef.current = Comlink.wrap<AdaptiveEngineApi>(worker)
    setReady(true)

    return () => {
      worker.terminate()
      apiRef.current = null
    }
  }, [])

  return { api: apiRef, ready }
}
