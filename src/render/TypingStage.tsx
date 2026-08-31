import * as Comlink from 'comlink'
import { useEffect, useRef, useState } from 'react'
import { ALL_DOMAINS, DOMAIN_LEXERS } from '../domains'
import { detectMicroPauses, type MicroPause } from '../engine/fatigue'
import {
  computeAccuracy,
  computeBurstConsistency,
  computeNetWpm,
  computeRawWpm,
} from '../engine/metrics'
import type { AdaptiveEngineApi } from '../engine/worker'
import type { Domain, KeyEvent, SessionSummary } from '../engine/types'
import { Sparkline } from './Sparkline'
import { lineIndexForPosition, wrapText, type WrappedLine } from './wrapText'

const LIVE_RHYTHM_WINDOW = 30

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

// UI/UX Brief §09 Motion & Micro-interactions timings.
const CORRECT_FLASH_MS = 120
const INCORRECT_FLASH_MS = 160
const CARET_SLIDE_MS = 80
const CHUNK_FADE_MS = 200
const UPCOMING_OPACITY = 0.6

const INK_RGB: [number, number, number] = [11, 15, 25]
const PANEL_RGB: [number, number, number] = [20, 24, 36]
const FAINT_RGB: [number, number, number] = [138, 145, 166]
const TEAL_RGB: [number, number, number] = [79, 209, 197]
const AMBER_RGB: [number, number, number] = [255, 138, 92]
const BLUE_RGB: [number, number, number] = [109, 139, 255]

function lerpColor(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t)
  const g = Math.round(from[1] + (to[1] - from[1]) * t)
  const b = Math.round(from[2] + (to[2] - from[2]) * t)
  return `rgb(${r}, ${g}, ${b})`
}

interface TypingStageProps {
  api: React.RefObject<Comlink.Remote<AdaptiveEngineApi> | null>
  domain: Domain
  /** Focused Drill Mode: text is 100% weak-pair words, no contextual flow. */
  mode?: 'adaptive' | 'drill'
  onComplete: (
    summary: SessionSummary,
    microPauses: MicroPause[],
    sessionDurationMs: number,
  ) => void
}

export function TypingStage({ api, domain, mode = 'adaptive', onComplete }: TypingStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const targetTextRef = useRef('')
  const linesRef = useRef<WrappedLine[]>([])
  const positionRef = useRef(0)
  const correctFlagsRef = useRef<boolean[]>([])
  const flashTimestampsRef = useRef<number[]>([]) // when each typed index was typed, for the crossfade/shake
  const chunkFadeRef = useRef<{ fromIndex: number; at: number } | null>(null)
  const caretMoveRef = useRef<{ fromPosition: number; at: number }>({ fromPosition: 0, at: 0 })
  const reducedMotionRef = useRef(false)
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
  const gapHistoryRef = useRef<number[]>([]) // rolling inter-keystroke gaps, for the live rhythm waveform

  const [liveStats, setLiveStats] = useState({ wpmNet: 0, accuracy: 100, elapsedSec: 0 })
  const [targetedPair, setTargetedPair] = useState<string | null>(null)
  const [liveRhythm, setLiveRhythm] = useState<number[]>([])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mq.matches
    const handler = () => {
      reducedMotionRef.current = mq.matches
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
    const previousLength = targetTextRef.current.length
    const result = await api.current?.getNextChunk(
      Math.min(CHUNK_FETCH_CHARS, remainingToCap + 40),
      mode,
    )
    if (result && !endedRef.current) {
      targetTextRef.current = targetTextRef.current
        ? `${targetTextRef.current} ${result.text}`
        : result.text
      linesRef.current = [] // force the canvas paint loop to re-wrap on next frame
      chunkFadeRef.current = { fromIndex: previousLength, at: performance.now() }
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
    const microPauses = detectMicroPauses(keystrokeTimestampsRef.current)

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

    if (summary) onComplete(summary, microPauses, elapsed)
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
    flashTimestampsRef.current = []
    chunkFadeRef.current = null
    caretMoveRef.current = { fromPosition: 0, at: performance.now() }
    typedCountRef.current = 0
    correctCountRef.current = 0
    keystrokeTimestampsRef.current = []
    pendingEventsRef.current = []
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    sessionStartRef.current = null
    gapHistoryRef.current = []
    setTargetedPair(null)
    setLiveRhythm([])

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

      caretMoveRef.current = { fromPosition: positionRef.current, at: t }
      correctFlagsRef.current.push(correct)
      flashTimestampsRef.current.push(t)
      typedCountRef.current += 1
      if (correct) correctCountRef.current += 1
      positionRef.current += 1

      const priorTimestamp =
        keystrokeTimestampsRef.current[keystrokeTimestampsRef.current.length - 1]
      if (priorTimestamp !== undefined) {
        gapHistoryRef.current = [...gapHistoryRef.current, t - priorTimestamp].slice(
          -LIVE_RHYTHM_WINDOW,
        )
      }
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
      setLiveRhythm(gapHistoryRef.current)
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

        ctx.fillStyle = `rgb(${PANEL_RGB.join(',')})`
        ctx.fillRect(0, 0, width, height)

        const now = performance.now()
        const reducedMotion = reducedMotionRef.current
        const charWidth = ctx.measureText('0').width
        const lines = linesRef.current
        const position = positionRef.current
        const caretLine = lineIndexForPosition(lines, position)
        let firstVisible = Math.max(0, caretLine - 1)
        if (firstVisible + VISIBLE_LINES > lines.length) {
          firstVisible = Math.max(0, lines.length - VISIBLE_LINES)
        }

        function cellPosition(index: number): { x: number; y: number; row: number } | null {
          const lineIdx = lineIndexForPosition(lines, index)
          const row = lineIdx - firstVisible
          if (row < 0 || row >= VISIBLE_LINES || !lines[lineIdx]) return null
          const col = index - lines[lineIdx].start
          return { x: PADDING + col * charWidth, y: PADDING + row * LINE_HEIGHT, row }
        }

        for (let row = 0; row < VISIBLE_LINES; row++) {
          const line = lines[firstVisible + row]
          if (!line) continue
          const y = PADDING + row * LINE_HEIGHT

          for (let col = 0; col < line.text.length; col++) {
            const absoluteIndex = line.start + col
            if (absoluteIndex === position) continue // drawn separately, with the caret, below
            const char = line.text[col]
            const x = PADDING + col * charWidth

            if (absoluteIndex < position) {
              const correct = correctFlagsRef.current[absoluteIndex]
              const flashAt = flashTimestampsRef.current[absoluteIndex] ?? 0
              const duration = correct ? CORRECT_FLASH_MS : INCORRECT_FLASH_MS
              const progress = reducedMotion ? 1 : Math.min(1, (now - flashAt) / duration)
              ctx.globalAlpha = 1
              ctx.fillStyle = lerpColor(FAINT_RGB, correct ? TEAL_RGB : AMBER_RGB, progress)
              let drawX = x
              if (!correct && progress < 1) {
                drawX += Math.sin(progress * Math.PI * 4) * (1 - progress) * 1.5
              }
              ctx.fillText(char, drawX, y + 2)
            } else {
              let alpha = UPCOMING_OPACITY
              const fade = chunkFadeRef.current
              if (!reducedMotion && fade && absoluteIndex >= fade.fromIndex) {
                const fadeProgress = Math.min(1, (now - fade.at) / CHUNK_FADE_MS)
                alpha = UPCOMING_OPACITY * fadeProgress
              }
              ctx.globalAlpha = alpha
              ctx.fillStyle = `rgb(${FAINT_RGB.join(',')})`
              ctx.fillText(char, x, y + 2)
              ctx.globalAlpha = 1
            }
          }
        }

        const toCell = cellPosition(position)
        if (toCell) {
          let drawX = toCell.x
          const caretProgress = reducedMotion
            ? 1
            : Math.min(1, (now - caretMoveRef.current.at) / CARET_SLIDE_MS)
          if (caretProgress < 1) {
            const fromCell = cellPosition(caretMoveRef.current.fromPosition)
            if (fromCell && fromCell.row === toCell.row) {
              drawX = fromCell.x + (toCell.x - fromCell.x) * caretProgress
            }
          }
          ctx.globalAlpha = 1
          ctx.fillStyle = `rgb(${BLUE_RGB.join(',')})`
          ctx.fillRect(drawX, toCell.y, charWidth, LINE_HEIGHT - 4)
          const charAtPosition = targetTextRef.current[position]
          if (charAtPosition) {
            ctx.fillStyle = `rgb(${INK_RGB.join(',')})`
            ctx.fillText(charAtPosition, toCell.x, toCell.y + 2)
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
  }, [domain, mode])

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
        {mode === 'drill' && (
          <span className="kt-mono inline-flex items-center gap-1.5 rounded-full bg-engine-violet px-3 py-1 text-body font-medium text-ink">
            ◆ Drill mode
          </span>
        )}
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

      {liveRhythm.length >= 2 && (
        <div className="flex items-center gap-2 rounded border border-hairline bg-panel px-4 py-2">
          <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-faint">
            Rhythm
          </span>
          <Sparkline values={liveRhythm} color="#4FD1C5" width={200} height={28} />
        </div>
      )}

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
