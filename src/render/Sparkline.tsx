/**
 * EKG-style polyline — UI/UX Brief §05 "Latency Waveform" motif, used here as
 * the literal per-pair/per-session latency trend chart.
 */
export function Sparkline({
  values,
  color = '#4FD1C5',
  width = 160,
  height = 40,
}: {
  values: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (values.length < 2) {
    return <p className="kt-mono text-body text-faint">Not enough sessions yet to chart a trend.</p>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const padding = 4

  const points = values
    .map((value, i) => {
      const x = i * stepX
      const y = padding + (1 - (value - min) / range) * (height - padding * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label={`Trend over ${values.length} sessions, from ${values[0].toFixed(0)}ms to ${values[values.length - 1].toFixed(0)}ms`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
