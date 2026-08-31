# Kinetic Type

An adaptive, domain-driven typing instrument. It watches your sub-key latency, finds the
specific two-key transitions costing you time and errors (`Shift→{`, `sudo ␣`, `th`), and
silently rewrites your practice text to drill exactly those — across Dev, CLI, and Prose modes.

Full specs live in [`docs/`](./docs): PRD, TRD, UI/UX Brief, App Flow, Backend Schema, and the
Implementation Plan this build follows phase by phase.

## Status

**Phase 1 — Engine Foundation** (Implementation Plan §03). A real, honest Prose-mode typing test:
high-precision keystroke capture, a virtualized canvas renderer with word-wrapped text, live
WPM/accuracy/burst-consistency, and a working n-gram latency matrix persisted to IndexedDB. No
adaptivity yet — the text stream doesn't react to your weak pairs (that's Phase 2), and there's
no Dev/CLI mode, heatmap, or account sync yet either.

## Stack

| Layer              | Choice                                                                |
| ------------------ | --------------------------------------------------------------------- |
| UI framework       | React 18 + TypeScript                                                 |
| Typing surface     | Custom Canvas 2D renderer (no native inputs)                          |
| Background compute | Web Worker via [Comlink](https://github.com/GoogleChromeLabs/comlink) |
| Local persistence  | IndexedDB via [Dexie](https://dexie.org/), inside the worker          |
| State              | Zustand — installed, not wired in yet (Phase 1 state is local/refs)   |
| Styling            | Tailwind CSS, tokens from the UI/UX Brief                             |
| Cloud sync         | Firebase — Auth, Firestore, Cloud Functions _(Phase 4)_               |
| Hosting            | Vercel (Git-integrated preview/production deploys)                    |
| Testing            | Vitest (unit), Playwright (e2e / visual regression)                   |

See [TRD §02](./docs/Kinetic_Type_02_TRD.pdf) for the full stack rationale.

## Getting started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Press **Start session** and type — Prose-mode text streams in,
each keystroke is timestamped and color-coded (teal = correct, amber = miss, blue block = cursor),
live WPM/accuracy/elapsed update above the stage, and pressing **Esc** (or finishing the passage)
ends the session and shows your slowest key-pair transitions.

## Scripts

| Command                | Does                              |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Start the Vite dev server         |
| `npm run build`        | Typecheck + production build      |
| `npm run test`         | Run unit tests once (Vitest)      |
| `npm run test:watch`   | Unit tests in watch mode          |
| `npm run test:e2e`     | Run Playwright end-to-end tests   |
| `npm run lint`         | ESLint                            |
| `npm run format`       | Prettier, writes changes          |
| `npm run format:check` | Prettier, check only (used in CI) |
| `npm run typecheck`    | `tsc` with no emit                |

## Project structure

```
src/
  app/       Root shell (App.tsx) — idle / active / complete session states
  domains/   Domain lexers (prose.ts is the only one so far; Dev/CLI are Phase 2)
  data/      Dexie schema (ngram_stats, session_logs) — used from inside the worker
  engine/    Adaptive Engine worker, session orchestration, n-gram matrix, metrics
  render/    Canvas typing stage, results panel, small UI motifs (keycap chips)
  lib/       Firebase client init (not called from app code yet — Phase 4)
  test/      Vitest setup
e2e/         Playwright end-to-end specs
docs/        The six source documents this build follows
```

Phase 2 adds the Dev and CLI lexers, the W(P) weighting formula and Dynamic Material
Synthesizer (adaptive text selection), and the spaced-repetition queue.

## Firebase

The app is fully functional offline with zero Firebase config through Phase 3 — Firestore is only
a backup/sync mirror (TRD §01), and nothing in the app code calls into Firebase yet. The
`kinetic-type-99316` project is provisioned (Auth: Anonymous + Email/Password, Firestore in
production mode) and the SDK is wired up in [`src/lib/firebase.ts`](./src/lib/firebase.ts), but
Auth/Firestore integration into the actual product is Phase 4 work (Implementation Plan §06).

- `.env.local` (untracked, not in git) holds the real project's Web app config.
- `firestore.rules` / `firestore.indexes.json` mirror Backend Schema §05-06 exactly — every
  user can only read/write their own `users/{uid}` subtree; `corpora/*` is public read-only.
- `firebase.json` configures the local Emulator Suite (Auth :9099, Firestore :8080,
  Functions :5001, UI :4000) — dev should run against this, never the real project, per TRD §11.

**One-time setup on your machine** (needs your own Google account, so this is yours to run):

```bash
npx firebase login          # opens a browser to authenticate with the Google account
                             # that owns the kinetic-type-99316 project
npm run firebase:emulators  # starts Auth + Firestore emulators locally
```

Then set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local` to point the app at them instead of
the real project.

**Deploying security rules** (only once there's something worth protecting, i.e. Phase 4+):

```bash
npm run firebase:deploy:rules
```

TRD §11 also calls for separate `staging` and `prod` Firebase projects — `kinetic-type-99316` is
serving as the single dev project for now; splitting that out is a Phase 4/5 task, not urgent yet.

## Deployment

Hosting runs on [Vercel](https://vercel.com), not Firebase Hosting (TRD §05) — connect the GitHub
repo to a Vercel project and every push gets a preview URL; merges to `main` promote to
production automatically. No deploy credentials are needed in CI (TRD §11).
