import * as Comlink from 'comlink'
import { useEffect, useRef, useState } from 'react'
import type { AdaptiveEngineApi } from '../engine/worker'
import type { KeyEvent } from '../engine/types'

interface StreamEntry {
  char: string
  roundTripMs: number
}

const MAX_ENTRIES = 40

/**
 * Phase 0 architecture spike — proves the full latency-critical pipeline:
 * keydown captured on the main thread -> timestamped -> sent to the Adaptive
 * Engine worker -> echoed back -> painted to canvas. No adaptivity, no
 * domains, no persistence yet; those are Phase 1+ (Implementation Plan §03).
 */
export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const apiRef = useRef<Comlink.Remote<AdaptiveEngineApi> | null>(null)
  const entriesRef = useRef<StreamEntry[]>([])
  const [lastRoundTripMs, setLastRoundTripMs] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    apiRef.current = Comlink.wrap<AdaptiveEngineApi>(worker)
    setReady(true)

    return () => {
      worker.terminate()
      workerRef.current = null
      apiRef.current = null
    }
  }, [])

  useEffect(() => {
    function paint() {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      ctx.fillStyle = '#141824' // panel
      ctx.fillRect(0, 0, width, height)

      ctx.font = '16px "JetBrains Mono", ui-monospace, Consolas, monospace'
      ctx.textBaseline = 'middle'

      let x = 16
      const y = height / 2
      for (const entry of entriesRef.current) {
        const isSlow = entry.roundTripMs > 8
        ctx.fillStyle = isSlow ? '#FF8A5C' : '#4FD1C5' // friction-amber : signal-teal
        ctx.fillText(entry.char === ' ' ? '·' : entry.char, x, y)
        x += 11
      }

      // block caret
      ctx.fillStyle = '#6D8BFF' // structure-blue
      ctx.fillRect(x, y - 10, 9, 20)
    }

    let frame: number
    function loop() {
      paint()
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.length !== 1 && e.key !== ' ') return // printable characters only for the spike
      const api = apiRef.current
      if (!api) return

      const event: KeyEvent = {
        code: e.code,
        char: e.key,
        type: 'down',
        t: performance.now(),
        domain: 'PROSE',
      }

      // Round-trip is measured entirely on the main thread's own clock (send time vs.
      // receive time) — the worker's echoed timestamp is on a different time origin
      // and is not directly comparable (see types.ts).
      void api.echo(event).then(() => {
        const roundTripMs = performance.now() - event.t
        entriesRef.current = [...entriesRef.current, { char: event.char, roundTripMs }].slice(
          -MAX_ENTRIES,
        )
        setLastRoundTripMs(roundTripMs)
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-faint">
          {ready ? 'Worker connected' : 'Connecting worker…'}
        </span>
        <span className="kt-mono text-body text-faint">
          last round-trip:{' '}
          <span className="text-signal-teal">
            {lastRoundTripMs === null ? '—' : `${lastRoundTripMs.toFixed(2)}ms`}
          </span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="h-24 w-full rounded border border-hairline"
        aria-label="Typing stage architecture spike"
      />
      <p className="kt-mono text-body text-faint">
        Type anything — each keystroke is timestamped on this thread, round-tripped through the
        Adaptive Engine worker, and painted above. Teal = round-trip under 8ms, amber = over.
      </p>
    </div>
  )
}
