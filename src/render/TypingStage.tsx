import * as Comlink from 'comlink'
import { useEffect, useRef, useState } from 'react'
import { ALL_DOMAINS, DOMAIN_LEXERS } from '../domains'
import {
  computeAccuracy,
  computeBurstConsistency,
  computeNetWpm,
  computeRawWpm,
} from '../engine/metrics'
import type { AdaptiveEngineApi } from '../engine/worker'
import type { Domain, KeyEvent, SessionSummary } from '../engine/types'
import { lineIndexForPosition, wrapText, type WrappedLine } from './wrapText'

// Fixed-length session for Phase 1/2 (Implementation Plan §03) — user-selectable
// session length (time or char-count) is FR-13, P2, deferred.
const SESSION_TARGET_CHARS = 400
// TRD §03: batch flushed to the worker every 50ms or 32 events, whichever first.
const BATCH_MAX_EVENTS = 32
const BATCH_INTERVAL_MS = 50
// TRD §04 Worker Execution Budget: "Next-chunk synthesis: When buffer < 40 chars remaining."
const BUFFER_LOW_THRESHOLD = 40
const CHUNK_FETCH_CHARS = 200

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
  domain: Domain
  onComplete: (summary: SessionSummary) => void
}

export function TypingStage({ api, domain, onComplete }: TypingStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const targetTextRef = useRef('')
  const linesRef = useRef<WrappedLine[]>([])
  const positionRef = useRef(0)
  const correctFlagsRef = useRef<boolean[]>([])
  const typedCountRef = useRef(0)
  const correctCountRef = useRef(0)
  const keystrokeTimestampsRef = useRef<number[]>([])
  const pendingEventsRef = useRef<KeyEvent[]>([])
  // null until the first keystroke — the clock starts on first input, not on
  // clicking "Start session", so thinking time before typing doesn't tax WPM.
  const sessionStartRef = useRef<number | null>(null)
  const totalPausedMsRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
  const endedRef = useRef(false)
  const fetchingChunkRef = useRef(false)

  const [liveStats, setLiveStats] = useState({ wpmNet: 0, accuracy: 100, elapsedSec: 0 })
  const [targetedPair, setTargetedPair] = useState<string | null>(null)

  function elapsedMsAt(now: number): number {
    if (sessionStartRef.current === null) return 0
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

  async function topUpBufferIfNeeded() {
    if (fetchingChunkRef.current || endedRef.current) return
    const remaining = targetTextRef.current.length - positionRef.current
    const remainingToCap = SESSION_TARGET_CHARS - targetTextRef.current.length
    if (remaining >= BUFFER_LOW_THRESHOLD || remainingToCap <= 0) return

    fetchingChunkRef.current = true
    const result = await api.current?.getNextChunk(Math.min(CHUNK_FETCH_CHARS, remainingToCap + 40))
    if (result && !endedRef.current) {
      targetTextRef.current = targetTextRef.current
        ? `${targetTextRef.current} ${result.text}`
        : result.text
      linesRef.current = [] // force the canvas paint loop to re-wrap on next frame
      setTargetedPair(result.targetedPair)
    }
    fetchingChunkRef.current = false
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
      domain_type: domain,
      wpm_raw: computeRawWpm(typedCountRef.current, elapsed),
      wpm_net: computeNetWpm(typedCountRef.current, errors, elapsed),
      accuracy: computeAccuracy(correctCountRef.current, typedCountRef.current),
      burst_consistency: computeBurstConsistency(
        keystrokeTimestampsRef.current,
        sessionStartRef.current ?? 0,
      ),
      timestamp: Date.now(),
    })

    if (summary) onComplete(summary)
  }

  // Session setup: start the worker session, fetch the first chunk, wire up
  // input capture, batching, and the render loop. Runs once per mount — App.tsx
  // remounts this component fresh for each "Type Again" / domain change.
  useEffect(() => {
    endedRef.current = false
    targetTextRef.current = ''
    linesRef.current = []
    positionRef.current = 0
    correctFlagsRef.current = []
    typedCountRef.current = 0
    correctCountRef.current = 0
    keystrokeTimestampsRef.current = []
    pendingEventsRef.current = []
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    sessionStartRef.current = null
    setTargetedPair(null)

    void (async () => {
      await api.current?.startSession(domain)
      await topUpBufferIfNeeded()
    })()

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
      if (sessionStartRef.current === null) sessionStartRef.current = t

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
        domain,
        correct,
      })
      if (pendingEventsRef.current.length >= BATCH_MAX_EVENTS) flush()

      if (positionRef.current >= SESSION_TARGET_CHARS) {
        void finishSession()
      } else {
        void topUpBufferIfNeeded()
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (endedRef.current || e.key.length !== 1) return
      pendingEventsRef.current.push({
        code: e.code,
        char: e.key,
        type: 'up',
        t: performance.now(),
        domain,
      })
      if (pendingEventsRef.current.length >= BATCH_MAX_EVENTS) flush()
    }

    function onVisibilityChange() {
      // nothing to pause before the clock has even started
      if (sessionStartRef.current === null) return

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

        if (linesRef.current.length === 0 && width > 0 && targetTextRef.current.length > 0) {
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
  }, [domain])

  const activeLexer = DOMAIN_LEXERS[domain]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {ALL_DOMAINS.map((lexer) => (
          <span
            key={lexer.id}
            className={`kt-mono inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-body font-medium ${
              lexer.id === activeLexer.id
                ? 'bg-signal-teal text-ink'
                : 'border border-hairline text-faint'
            }`}
          >
            {lexer.glyph} {lexer.label.toUpperCase()}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={liveStats.wpmNet.toFixed(0)} label="WPM Net" valueClassName="text-cream" />
        <StatTile value={`${liveStats.accuracy.toFixed(1)}%`} label="Accuracy" />
        <StatTile value={formatElapsed(liveStats.elapsedSec)} label="Elapsed" />
        <StatTile
          value={targetedPair ? targetedPair.replace('->', '→') : '—'}
          label="Targeted pair"
          valueClassName="text-friction-amber"
        />
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
