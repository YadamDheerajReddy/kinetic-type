import type { HeatmapEntry } from '../engine/types'
import { computeHeatmapColors } from './heatmapColor'

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

/**
 * Latency heatmap — UI/UX Brief §08. Key intensity = avg. transition latency
 * *into* that key. Colorblind-safe (teal->amber, never red->green), and
 * intensity is also carried by saturation/lightness, not hue alone (§11).
 */
export function KeyboardHeatmap({
  entries,
  hotKey,
}: {
  entries: HeatmapEntry[]
  /** Destination char of the currently top-weighted pair — gets the "hot" pulse (UI/UX Brief §09). */
  hotKey?: string | null
}) {
  const colors = computeHeatmapColors(entries)
  const dataByKey = new Map(entries.map((entry) => [entry.key, entry]))

  function cellStyle(key: string) {
    const color = colors.get(key.toLowerCase())
    return {
      backgroundColor: color ?? '#1B2030',
      color: color ? '#0B0F19' : '#8A91A6',
    }
  }

  function cellLabel(key: string) {
    const entry = dataByKey.get(key.toLowerCase())
    return entry
      ? `${key}: ${entry.avgLatencyMs.toFixed(0)}ms average, ${entry.occurrences} times typed`
      : `${key}: no data yet`
  }

  const hasAnyData = entries.some((entry) => entry.occurrences > 0)

  return (
    <div className="flex flex-col gap-3">
      {hasAnyData ? (
        <div className="flex flex-col items-center gap-1.5">
          {ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1.5" style={{ marginLeft: rowIndex * 14 }}>
              {row.map((letter) => (
                <div
                  key={letter}
                  title={cellLabel(letter)}
                  aria-label={cellLabel(letter)}
                  className={`kt-mono flex h-9 w-9 items-center justify-center rounded border border-hairline text-body font-medium ${
                    hotKey === letter.toLowerCase() ? 'kt-hot-pulse' : ''
                  }`}
                  style={cellStyle(letter)}
                >
                  {letter}
                </div>
              ))}
            </div>
          ))}
          <div
            title={cellLabel(' ').replace(' ', 'space')}
            aria-label={cellLabel(' ').replace(' :', 'Space:')}
            className="kt-mono mt-0.5 flex h-9 w-64 items-center justify-center rounded border border-hairline text-body text-faint"
            style={cellStyle(' ')}
          >
            space
          </div>
        </div>
      ) : (
        <p className="kt-mono text-body text-faint">
          No key data yet this session — type a bit more and the map fills in.
        </p>
      )}
      <p className="kt-mono text-body text-faint">
        Key intensity = avg. transition latency into that key · amber = slowest
      </p>
    </div>
  )
}
