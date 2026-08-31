import { describe, expect, it } from 'vitest'
import { detectTrendDirection } from './regression'

describe('detectTrendDirection', () => {
  it('flags regressing when the later half is meaningfully slower than the earlier half', () => {
    expect(detectTrendDirection([100, 100, 150, 160])).toBe('regressing')
  })

  it('flags improving when the later half is meaningfully faster', () => {
    expect(detectTrendDirection([160, 150, 100, 100])).toBe('improving')
  })

  it('calls it stable for small fluctuations under the threshold', () => {
    expect(detectTrendDirection([100, 102, 98, 101])).toBe('stable')
  })

  it('calls it stable with too little history to trust a trend', () => {
    expect(detectTrendDirection([100, 200])).toBe('stable')
    expect(detectTrendDirection([])).toBe('stable')
  })
})
