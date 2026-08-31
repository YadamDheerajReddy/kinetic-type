import { describe, expect, it } from 'vitest'
import { lineIndexForPosition, wrapText } from './wrapText'

describe('wrapText', () => {
  it('never splits a word and keeps lines at or under charsPerLine', () => {
    const text = 'the quick brown fox jumps over the lazy dog'
    const lines = wrapText(text, 12)

    for (const line of lines) {
      expect(line.text.length).toBeLessThanOrEqual(12)
      expect(line.text.split(' ').every((w) => text.includes(w))).toBe(true)
    }
  })

  it('records correct start offsets into the original text', () => {
    const text = 'aaa bbb ccc ddd'
    const lines = wrapText(text, 8) // fits "aaa bbb" (7 chars) then "ccc ddd"

    expect(lines[0]).toEqual({ text: 'aaa bbb', start: 0 })
    expect(lines[1]).toEqual({ text: 'ccc ddd', start: 8 })
  })

  it('hard-breaks a single word longer than charsPerLine', () => {
    const lines = wrapText('supercalifragilistic', 8)
    expect(lines[0].text).toBe('supercal')
    expect(lines[0].text.length).toBe(8)
  })

  it('handles an empty string without crashing', () => {
    expect(wrapText('', 10)).toEqual([{ text: '', start: 0 }])
  })
})

describe('lineIndexForPosition', () => {
  it('finds the line containing a given absolute text index', () => {
    const lines = wrapText('aaa bbb ccc ddd', 8) // ["aaa bbb", "ccc ddd"] starting at 0, 8

    expect(lineIndexForPosition(lines, 0)).toBe(0)
    expect(lineIndexForPosition(lines, 6)).toBe(0)
    expect(lineIndexForPosition(lines, 8)).toBe(1)
    expect(lineIndexForPosition(lines, 14)).toBe(1)
  })
})
