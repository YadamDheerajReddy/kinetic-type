import type { Config } from 'tailwindcss'

/**
 * Tailwind token mapping — Kinetic Type UI/UX Brief §03 (Color System) & §04 (Typography System).
 * Keep this file the single source of truth for design tokens; CSS variables in src/index.css mirror it.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        ink: '#0B0F19',
        panel: '#141824',
        'signal-teal': '#4FD1C5',
        'structure-blue': '#6D8BFF',
        'friction-amber': '#FF8A5C',
        'engine-violet': '#C792EA',
        cream: '#E9ECF5',
        faint: '#8A91A6',
        hairline: '#262C3D',
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing, fontWeight }] — UI/UX Brief §04 Type Scale
        display: ['30px', { lineHeight: '1.15', fontWeight: '700' }],
        h1: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        h2: ['15px', { lineHeight: '1.3', fontWeight: '600' }],
        stat: ['22px', { lineHeight: '1.2', fontWeight: '700' }],
        body: ['11px', { lineHeight: '1.5', fontWeight: '400' }],
        stream: ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        eyebrow: ['9px', { lineHeight: '1.4', letterSpacing: '0.12em', fontWeight: '500' }],
      },
      transitionTimingFunction: {
        'kt-out': 'ease-out',
        'kt-in-out': 'ease-in-out',
        'kt-panel': 'cubic-bezier(.2,.8,.2,1)',
      },
      transitionDuration: {
        120: '120ms',
        160: '160ms',
        80: '80ms',
        200: '200ms',
        220: '220ms',
        300: '300ms',
      },
    },
  },
  plugins: [],
} satisfies Config
