import type { Domain } from '../engine/types'
import { cliLexer } from './cli'
import { devLexer } from './dev'
import { proseLexer } from './prose'
import type { DomainLexer } from './types'

export const DOMAIN_LEXERS: Record<Domain, DomainLexer> = {
  CODE_TS: devLexer,
  CLI_BASH: cliLexer,
  PROSE: proseLexer,
}

// Display order matches the UI/UX Brief §06/§07 mockups: Dev, CLI, Prose.
export const ALL_DOMAINS: DomainLexer[] = [devLexer, cliLexer, proseLexer]

export type { DomainLexer } from './types'
