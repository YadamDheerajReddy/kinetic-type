import * as Comlink from 'comlink'
import { useEffect, useRef, useState } from 'react'
import { proseLexer } from '../domains/prose'
import type { AdaptiveEngineApi } from '../engine/worker'
import {
  computeAccuracy,
  computeBurstConsistency,
  computeNetWpm,
  computeRawWpm,
} from '../engine/metrics'
import type { KeyEvent, SessionSummary } from '../engine/types'
import { lineIndexForPosition, wrapText, type WrappedLine } from './wrapText'

// Fixed-length session for Phase 1 (Implementation Plan §03) — user-selectable
// session length (time or char-count) is FR-13, P2, deferred past Phase 1.
const SESSION_TARGET_CHARS = 300
// TRD §03: batch flushed to the worker every 50ms or 32 events, whichever first.
const BATCH_MAX_EVENTS = 32
const BATCH_INTERVAL_MS = 50

const FONT = '16px "JetBrains Mono", ui-monospace, Consolas, monospace'
const LINE_HEIGHT = 24
const VISIBLE_LINES = 4
const PADDING = 16

const COLOR_INK = '#0B0F19'
const COLOR_PANEL = '#141824'
const COLOR_FAINT = '#8A91A6'
const COLOR_TEAL = '#4FD1C5'
const COLOR_AMBER = '#FF8A5C'
const COLOR_BLUE = '#6D8BFF'

interface TypingStageProps {
  api: React.RefObject<Comlink.Remote<AdaptiveEngineApi> | null>
  onComplete: (summary: SessionSummary) => void
}

export function TypingStage({ api, onComplete }: TypingStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const targetTextRef = useRef('')
  const linesRef = useRef<WrappedLine[]>([])
  const positionRef = useRef(0)
  const correctFlagsRef = useRef<boolean[]>([])
  const typedCountRef = useRef(0)
  const correctCountRef = useRef(0)
  const keystrokeTimestampsRef = useRef<number[]>([])
  const pendingEventsRef = useRef<KeyEvent[]>([])
  const sessionStartRef = useRef(0)
  const totalPausedMsRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
  const endedRef = useRef(false)

  const [liveStats, setLiveStats] = useState({ wpmNet: 0, accuracy: 100, elapsedSec: 0 })

  function elapsedMsAt(now: number): number {
    const pausedSoFar =
      totalPausedMsRef.current + (pausedAtRef.current !== null ? now - pausedAtRef.current : 0)
    return Math.max(0, now - sessionStartRef.current - pausedSoFar)
  }

  function flush() {
    if (pendingEventsRef.current.length === 0) return
    const batch = pendingEventsRef.current
    pendingEventsRef.current = []
    void api.current?.processBatch(batch)
  }

  async function finishSession() {
    if (endedRef.current) return
    endedRef.current = true
    flush()

    const now = performance.now()
    const elapsed = elapsedMsAt(now)
    const errors = typedCountRef.current - correctCountRef.current

    const summary = await api.current?.endSession({
      session_id: crypto.randomUUID(),
      domain_type: 'PROSE',
      wpm_raw: computeRawWpm(typedCountRef.current, elapsed),
      wpm_net: computeNetWpm(typedCountRef.current, errors, elapsed),
      accuracy: computeAccuracy(correctCountRef.current, typedCountRef.current),
      burst_consistency: computeBurstConsistency(
        keystrokeTimestampsRef.current,
        sessionStartRef.current,
      ),
      timestamp: Date.now(),
    })

    if (summary) onComplete(summary)
  }

  // Session setup: generate the passage, start the worker session, wire up
  // input capture, batching, and the render loop. Runs once per mount — App.tsx
  // remounts this component fresh for each "Type Again".
  useEffect(() => {
    endedRef.current = false
    const randomStart = Math.floor(Math.random() * 5000)
    targetTextRef.current = proseLexer.nextChunk(randomStart, SESSION_TARGET_CHARS).text
    positionRef.current = 0
    correctFlagsRef.current = []
    typedCountRef.current = 0
    correctCountRef.current = 0
    keystrokeTimestampsRef.current = []
    pendingEventsRef.current = []
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    sessionStartRef.current = performance.now()

    void api.current?.startSession('PROSE')

    function onKeyDown(e: KeyboardEvent) {
      if (endedRef.current) return

      if (e.key === 'Escape') {
        e.preventDefault()
        void finishSession()
        return
      }

      if (e.key.length !== 1 || e.repeat) return
      if (positionRef.current >= targetTextRef.current.length) return
      e.preventDefault()

      const expected = targetTextRef.current[positionRef.current]
      const correct = e.key === expected
      const t = performance.now()

      correctFlagsRef.current.push(correct)
      typedCountRef.current += 1
      if (correct) correctCountRef.current += 1
      positionRef.current += 1
      keystrokeTimestampsRef.current.push(t)

      pendingEventsRef.current.push({
        code: e.code,
        char: e.key,
        type: 'down',
        t,
        domain: 'PROSE',
        correct,
      })
      if (pendingEventsRef.current.length >= BATCH_MAX_EVENTS) flush()

      if (positionRef.current >= targetTextRef.current.length) {
        void finishSession()
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (endedRef.current || e.key.length !== 1) return
      pendingEventsRef.current.push({
        code: e.code,
        char: e.key,
        type: 'up',
        t: performance.now(),
        domain: 'PROSE',
      })
      if (pendingEventsRef.current.length >= BATCH_MAX_EVENTS) flush()
    }

    function onVisibilityChange() {
      if (document.hidden) {
        pausedAtRef.current = performance.now()
        void api.current?.resetPairing()
      } else if (pausedAtRef.current !== null) {
        totalPausedMsRef.current += performance.now() - pausedAtRef.current
        pausedAtRef.current = null
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', onVisibilityChange)

    const flushInterval = setInterval(flush, BATCH_INTERVAL_MS)
    const statsInterval = setInterval(() => {
      if (endedRef.current) return
      const now = performance.now()
      const elapsed = elapsedMsAt(now)
      const errors = typedCountRef.current - correctCountRef.current
      setLiveStats({
        wpmNet: computeNetWpm(typedCountRef.current, errors, elapsed),
        accuracy: computeAccuracy(correctCountRef.current, typedCountRef.current),
        elapsedSec: Math.floor(elapsed / 1000),
      })
    }, 200)

    let frame: number
    function paint() {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1
        const width = canvas.clientWidth
        const height = canvas.clientHeight
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr
          canvas.height = height * dpr
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.font = FONT
        ctx.textBaseline = 'top'

        if (linesRef.current.length === 0 && width > 0) {
          const charWidth = ctx.measureText('0').width
          const charsPerLine = Math.max(10, Math.floor((width - PADDING * 2) / charWidth))
          linesRef.current = wrapText(targetTextRef.current, charsPerLine)
        }

        ctx.fillStyle = COLOR_PANEL
        ctx.fillRect(0, 0, width, height)

        const charWidth = ctx.measureText('0').width
        const lines = linesRef.current
        const position = positionRef.current
        const caretLine = lineIndexForPosition(lines, position)
        let firstVisible = Math.max(0, caretLine - 1)
        if (firstVisible + VISIBLE_LINES > lines.length) {
          firstVisible = Math.max(0, lines.length - VISIBLE_LINES)
        }

        for (let row = 0; row < VISIBLE_LINES; row++) {
          const line = lines[firstVisible + row]
          if (!line) continue
          const y = PADDING + row * LINE_HEIGHT

          for (let col = 0; col < line.text.length; col++) {
            const absoluteIndex = line.start + col
            const char = line.text[col]
            const x = PADDING + col * charWidth

            if (absoluteIndex === position) {
              ctx.fillStyle = COLOR_BLUE
              ctx.fillRect(x, y, charWidth, LINE_HEIGHT - 4)
              ctx.fillStyle = COLOR_INK
              ctx.fillText(char, x, y + 2)
            } else if (absoluteIndex < position) {
              ctx.fillStyle = correctFlagsRef.current[absoluteIndex] ? COLOR_TEAL : COLOR_AMBER
              ctx.fillText(char, x, y + 2)
            } else {
              ctx.fillStyle = COLOR_FAINT
              ctx.fillText(char, x, y + 2)
            }
          }
        }
      }
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(flushInterval)
      clearInterval(statsInterval)
      cancelAnimationFrame(frame)
      linesRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session setup runs once per mount by design
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="kt-mono inline-flex items-center gap-1.5 rounded-full bg-signal-teal px-3 py-1 text-body font-medium text-ink">
          {proseLexer.glyph} {proseLexer.label.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={liveStats.wpmNet.toFixed(0)} label="WPM Net" valueClassName="text-cream" />
        <StatTile value={`${liveStats.accuracy.toFixed(1)}%`} label="Accuracy" />
        <StatTile value={formatElapsed(liveStats.elapsedSec)} label="Elapsed" />
      </div>

      <canvas
        ref={canvasRef}
        className="h-32 w-full rounded border border-hairline"
        aria-label="Typing stage"
        role="img"
      />

      <p className="kt-mono text-body text-faint">
        Teal = correct · amber = miss · blue block = cursor. Press Esc to end early.
      </p>
    </div>
  )
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function StatTile({
  value,
  label,
  valueClassName,
}: {
  value: string
  label: string
  valueClassName?: string
}) {
  return (
    <div className="rounded border border-hairline bg-panel px-4 py-3">
      <div className={`kt-mono text-stat ${valueClassName ?? 'text-cream'}`}>{value}</div>
      <div className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-faint">{label}</div>
    </div>
  )
}
