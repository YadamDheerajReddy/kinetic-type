import type { DomainLexer } from './types'

/**
 * Seed Prose corpus — public-domain literary openings, chosen to validate the
 * pipeline with real, recognizable prose rather than synthetic filler (PRD §10
 * risk: "Domain corpus feels generic"). Small placeholder set; Phase 5's
 * "Content & corpus review" is where source material gets properly expanded
 * and legally verified before launch (Implementation Plan §07).
 */
const PASSAGES: string[] = [
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.',
  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.',
  'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen, and regulating the circulation.',
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations.',
  'In the year 1878 I took my degree of Doctor of Medicine of the University of London, and proceeded to Netley to go through the course prescribed for surgeons in the army. Having completed my studies there, I was duly attached to the Fifth Northumberland Fusiliers as Assistant Surgeon.',
]

export const proseLexer: DomainLexer = {
  id: 'PROSE',
  label: 'Prose',
  glyph: '¶',
  words: PASSAGES.join(' ').split(/\s+/).filter(Boolean),
}
