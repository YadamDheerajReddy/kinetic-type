import { describe, expect, it } from 'vitest'
import { proseLexer } from './prose'

describe('proseLexer.nextChunk', () => {
  it('returns at least minChars, extended to a word boundary', () => {
    const { text } = proseLexer.nextChunk(0, 50)
    expect(text.length).toBeGreaterThanOrEqual(50)
    expect(text.endsWith(' ')).toBe(false)
    expect(text.trim()).toBe(text)
  })

  it('advances the cursor so consecutive calls do not overlap', () => {
    const first = proseLexer.nextChunk(0, 40)
    const second = proseLexer.nextChunk(first.cursor, 40)
    expect(second.cursor).toBeGreaterThan(first.cursor)
  })

  it('never returns an empty chunk, even near a wrap boundary', () => {
    const { text } = proseLexer.nextChunk(1_000_000, 60)
    expect(text.length).toBeGreaterThan(0)
  })

  it('snaps an arbitrary (e.g. random) cursor forward to a word boundary', () => {
    // corpus starts "It is a truth universally ..."; index 10 lands inside "truth"
    // (I-t- -i-s- -a- -t-r-u-...), so the chunk should start at "universally", not "uth"
    const { text } = proseLexer.nextChunk(10, 20)
    expect(text.startsWith('universally')).toBe(true)
  })
})
