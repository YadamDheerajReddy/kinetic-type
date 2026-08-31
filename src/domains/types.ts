import type { Domain } from '../engine/types'

// Domain lexer contract — PRD §06 FR-03. Phase 1 had Prose only, streaming
// sequentially; Phase 2's Dynamic Material Synthesizer (TRD §04) is now the
// single generation path for all domains, drawing from this flat word list
// rather than each lexer implementing its own chunking logic.
export interface DomainLexer {
  id: Domain
  label: string
  glyph: string
  words: readonly string[]
}
