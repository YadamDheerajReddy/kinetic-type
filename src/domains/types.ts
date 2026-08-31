// Domain lexer contract — PRD §06 FR-03. Dev and CLI lexers arrive in Phase 2
// (Implementation Plan §04); Prose is the one working lexer for Phase 1.
export interface DomainLexer {
  id: 'PROSE' | 'CODE_TS' | 'CLI_BASH'
  label: string
  glyph: string
  /**
   * Returns the next chunk of text starting at `cursor` characters into the
   * corpus, at least `minChars` long but not cut off mid-word, plus the
   * cursor position to resume from next call. Wraps back to the start when
   * the corpus is exhausted.
   *
   * Phase 1: pure sequential streaming, no weighting. Phase 2's Dynamic
   * Material Synthesizer (TRD §04) replaces this with weighted selection
   * without changing this interface.
   */
  nextChunk(cursor: number, minChars: number): { text: string; cursor: number }
}
