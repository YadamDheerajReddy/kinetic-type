export interface WrappedLine {
  text: string
  start: number // index into the original text where this line begins
}

/**
 * Greedy word-wrap for the monospace typing stream (UI/UX Brief §07 shows the
 * target text wrapping across multiple lines within the panel, not scrolling
 * as one long line). Never splits a word unless a single word is itself
 * longer than charsPerLine, in which case it hard-breaks as a fallback.
 */
export function wrapText(text: string, charsPerLine: number): WrappedLine[] {
  if (charsPerLine <= 0) return [{ text, start: 0 }]

  const lines: WrappedLine[] = []
  let lineStart = 0

  while (lineStart < text.length) {
    let end = Math.min(lineStart + charsPerLine, text.length)
    if (end < text.length && text[end] !== ' ') {
      const lastSpace = text.lastIndexOf(' ', end)
      if (lastSpace > lineStart) {
        end = lastSpace
      }
      // else: one "word" exceeds charsPerLine — leave `end` as a hard break
    }
    lines.push({ text: text.slice(lineStart, end), start: lineStart })
    lineStart = end < text.length && text[end] === ' ' ? end + 1 : end
  }

  return lines.length > 0 ? lines : [{ text: '', start: 0 }]
}

/** The last line whose start offset is at or before `position`. */
export function lineIndexForPosition(lines: WrappedLine[], position: number): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (position >= lines[i].start) return i
  }
  return 0
}
