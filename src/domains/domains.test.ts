import { describe, expect, it } from 'vitest'
import { ALL_DOMAINS, DOMAIN_LEXERS } from './index'

describe('domain lexers', () => {
  it('registers exactly the three PRD FR-03 domains, keyed by their id', () => {
    expect(Object.keys(DOMAIN_LEXERS).sort()).toEqual(['CLI_BASH', 'CODE_TS', 'PROSE'].sort())
    for (const domain of Object.keys(DOMAIN_LEXERS) as (keyof typeof DOMAIN_LEXERS)[]) {
      expect(DOMAIN_LEXERS[domain].id).toBe(domain)
    }
  })

  it('gives every domain a non-empty word list to synthesize from', () => {
    for (const lexer of ALL_DOMAINS) {
      expect(lexer.words.length).toBeGreaterThan(20)
      expect(lexer.words.every((w) => w.length > 0)).toBe(true)
    }
  })

  it('Dev mode words include camelCase/bracket-heavy tokens (PRD US-01)', () => {
    const dev = DOMAIN_LEXERS.CODE_TS
    expect(dev.words.some((w) => w.includes('('))).toBe(true)
    expect(dev.words.some((w) => /[a-z][A-Z]/.test(w))).toBe(true) // camelCase somewhere
  })

  it('CLI mode words include flags and paths (PRD US-03)', () => {
    const cli = DOMAIN_LEXERS.CLI_BASH
    expect(cli.words.some((w) => w.startsWith('-'))).toBe(true)
    expect(cli.words.some((w) => w.includes('/'))).toBe(true)
  })
})
