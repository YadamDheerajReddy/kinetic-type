import { CanvasStage } from '../render/CanvasStage'

export function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="kt-mono text-eyebrow uppercase tracking-[0.12em] text-engine-violet">
          Phase 0 — Setup & Foundations
        </span>
        <h1 className="font-display text-display text-cream">
          Kinetic <span className="text-signal-teal">Type</span>
        </h1>
        <p className="text-body text-faint">
          A dark instrument panel that turns your own hands into the interface. This screen is the
          Phase 0 architecture spike — the real onboarding, domain select, and typing stage arrive
          in Phase 1.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded border border-hairline bg-panel p-6">
        <h2 className="font-display text-h2 text-cream">Architecture spike</h2>
        <CanvasStage />
      </section>
    </div>
  )
}
