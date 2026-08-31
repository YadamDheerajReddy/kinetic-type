import type { SessionSummary } from '../engine/types'

const COLUMNS = [
  'session_id',
  'domain_type',
  'timestamp',
  'wpm_raw',
  'wpm_net',
  'accuracy',
  'burst_consistency',
  'top_pairs',
] as const

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Export Your Data: your own local session history as CSV, for anyone who
 * wants to poke at it in a spreadsheet — this is local-first data the user
 * already owns, per App Flow §05 "Share/Export."
 */
export function sessionsToCsv(sessions: SessionSummary[]): string {
  const header = COLUMNS.join(',')
  const rows = sessions.map((s) =>
    [
      s.session_id,
      s.domain_type,
      new Date(s.timestamp).toISOString(),
      s.wpm_raw.toFixed(1),
      s.wpm_net.toFixed(1),
      s.accuracy.toFixed(1),
      s.burst_consistency.toFixed(2),
      csvCell(s.top_pairs.map((p) => `${p.pair}:${p.ms}ms`).join('; ')),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
