/**
 * Keycap chip motif — UI/UX Brief §05: "monospace label, 1px border, subtle
 * bottom-edge shadow suggesting key travel." Used anywhere a specific key or
 * key-pair is referenced (results list now; heatmap tooltips in Phase 3).
 */
export function KeycapChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="kt-mono inline-flex items-center rounded border border-hairline bg-panel px-2 py-0.5 text-body text-cream shadow-[0_2px_0_0_theme(colors.hairline)]">
      {children}
    </span>
  )
}
