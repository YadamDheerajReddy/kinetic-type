import { ALL_DOMAINS } from '../domains'
import type { Domain } from '../engine/types'

/**
 * Onboarding & Domain Select — UI/UX Brief §06. Picking a card is the action
 * itself (App Flow §02 Step 2), not a separate confirm step: "User taps Dev,
 * CLI, or Prose" starts the session directly.
 */
export function DomainSelect({ onSelect }: { onSelect: (domain: Domain) => void }) {
  return (
    <section className="flex flex-col gap-4 rounded border border-hairline bg-panel p-6">
      <div className="flex flex-col gap-1">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-signal-teal">
          ◆ Choose your domain
        </span>
        <h2 className="font-display text-h1 text-cream">What does your keyboard usually do?</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ALL_DOMAINS.map((lexer) => (
          <button
            key={lexer.id}
            type="button"
            onClick={() => onSelect(lexer.id)}
            className="flex flex-col items-center gap-2 rounded border border-hairline bg-ink px-4 py-6 text-center transition-colors duration-160 ease-kt-in-out hover:border-signal-teal"
          >
            <span className="kt-mono text-h1 text-signal-teal">{lexer.glyph}</span>
            <span className="font-display text-h2 text-cream">{lexer.label} Mode</span>
            <span className="kt-mono line-clamp-2 text-body text-faint">
              {lexer.words.slice(0, 10).join(' ')}
            </span>
          </button>
        ))}
      </div>

      <p className="kt-mono text-body text-faint">
        No account needed — your baseline calibrates in the first session.
      </p>
    </section>
  )
}
