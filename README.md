# Kinetic Type

An adaptive, domain-driven typing instrument. It watches your sub-key latency, finds the
specific two-key transitions costing you time and errors (`Shift→{`, `sudo ␣`, `th`), and
silently rewrites your practice text to drill exactly those — across Dev, CLI, and Prose modes.

Full specs live in [`docs/`](./docs): PRD, TRD, UI/UX Brief, App Flow, Backend Schema, and the
Implementation Plan this build follows phase by phase.

## Status

**Phase 3 — Visual Analytics & Polish** (Implementation Plan §05). The Results screen now shows a
keyboard-shaped latency heatmap (colorblind-safe teal→amber, weighted by real transition data),
a fatigue/micro-pause timeline, a per-pair trend sparkline, and a History & Trends screen charting
WPM/accuracy and your most-flagged transitions across recent sessions. The typing stage got a real
motion pass — keystroke crossfade + shake on misses, a sliding caret, chunk fade-in — all of it
stripped to instant color-only changes under `prefers-reduced-motion`. No account sync yet
(Phase 4); Focus Mode (light theme) remains deliberately deferred — not one of Phase 3's five
named workstreams.

## Stack

| Layer              | Choice                                                                |
| ------------------ | --------------------------------------------------------------------- |
| UI framework       | React 18 + TypeScript                                                 |
| Typing surface     | Custom Canvas 2D renderer (no native inputs)                          |
| Background compute | Web Worker via [Comlink](https://github.com/GoogleChromeLabs/comlink) |
| Local persistence  | IndexedDB via [Dexie](https://dexie.org/), inside the worker          |
| State              | Zustand — installed, not wired in yet (state is still local/refs)     |
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

Opens at `http://localhost:5173`. Pick a domain card and type — text streams in and is generated
live by the adaptive engine, each keystroke is timestamped and color-coded (teal = correct, amber
= miss, blue block = cursor), live WPM/accuracy/elapsed/targeted-pair update above the stage, and
pressing **Esc** (or finishing the passage) ends the session and drops you on Results: a latency
heatmap, a fatigue timeline, a trend sparkline for your slowest pair, and buttons to type again,
view history, or switch domain. Play a few sessions in the same domain and watch the "Targeted
pair" stat and the heatmap start reflecting your actual weak spots — that's the adaptive loop
working.

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
  app/       Root shell (App.tsx) — idle(domain select) / active / complete / history states
  domains/   Domain lexers — dev.ts, cli.ts, prose.ts, each a flat word list
  data/      Dexie schema (ngram_stats, session_logs, srs_queue, pair_history) — inside the worker
  engine/    Worker, session orchestration, n-gram matrix, weighting (W(P)), synthesizer,
             spaced-repetition queue, metrics, fatigue/micro-pause detection
  render/    Canvas typing stage (with the motion pass), domain select, results panel,
             keyboard heatmap, sparkline, fatigue timeline, history view, small UI motifs
  lib/       Firebase client init (not called from app code yet — Phase 4)
  test/      Vitest setup
e2e/         Playwright end-to-end specs
docs/        The six source documents this build follows
```

Phase 4 adds Firebase Auth (anonymous → upgraded), the Firestore sync engine, and account
backup/restore across devices.

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
