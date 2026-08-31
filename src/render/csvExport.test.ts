import { describe, expect, it } from 'vitest'
import { sessionsToCsv } from './csvExport'
import type { SessionSummary } from '../engine/types'

describe('sessionsToCsv', () => {
  it('writes a header row plus one row per session', () => {
    const sessions: SessionSummary[] = [
      {
        session_id: 's1',
        domain_type: 'PROSE',
        wpm_raw: 50.4,
        wpm_net: 48.1,
        accuracy: 97.2,
        burst_consistency: 0.87,
        top_pairs: [{ pair: 't->h', ms: 120 }],
        timestamp: 0,
      },
    ]

    const csv = sessionsToCsv(sessions)
    const lines = csv.split('\n')

    expect(lines[0]).toBe(
      'session_id,domain_type,timestamp,wpm_raw,wpm_net,accuracy,burst_consistency,top_pairs',
    )
    expect(lines[1]).toContain('s1,PROSE')
    expect(lines[1]).toContain('48.1')
    expect(lines[1]).toContain('t->h:120ms')
  })

  it('quotes and escapes the top_pairs field since it can contain commas', () => {
    const sessions: SessionSummary[] = [
      {
        session_id: 's1',
        domain_type: 'PROSE',
        wpm_raw: 1,
        wpm_net: 1,
        accuracy: 1,
        burst_consistency: 1,
        top_pairs: [
          { pair: 'a->b', ms: 1 },
          { pair: 'c->d', ms: 2 },
        ],
        timestamp: 0,
      },
    ]
    const csv = sessionsToCsv(sessions)
    expect(csv).toContain('"a->b:1ms; c->d:2ms"')
  })

  it('produces just a header row for an empty history', () => {
    expect(sessionsToCsv([]).split('\n')).toHaveLength(1)
  })
})
