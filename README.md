# Kinetic Type

An adaptive, domain-driven typing instrument. It watches your sub-key latency, finds the
specific two-key transitions costing you time and errors (`Shift→{`, `sudo ␣`, `th`), and
silently rewrites your practice text to drill exactly those — across Dev, CLI, and Prose modes.

Full specs live in [`docs/`](./docs): PRD, TRD, UI/UX Brief, App Flow, Backend Schema, and the
Implementation Plan this build follows phase by phase.

## Status

**Phase 0 — Setup & Foundations** (Implementation Plan §02). Nothing user-facing yet; this phase
proves the architecture holds together before Phase 1 builds the real typing engine.

## Stack

| Layer | Choice |
| --- | --- |
| UI framework | React 18 + TypeScript |
| Typing surface | Custom Canvas 2D renderer (no native inputs) |
| Background compute | Web Worker via [Comlink](https://github.com/GoogleChromeLabs/comlink) |
| Local persistence | IndexedDB via [Dexie](https://dexie.org/) *(Phase 1)* |
| State | Zustand *(Phase 1)* |
| Styling | Tailwind CSS, tokens from the UI/UX Brief |
| Cloud sync | Firebase — Auth, Firestore, Cloud Functions *(Phase 4)* |
| Hosting | Vercel (Git-integrated preview/production deploys) |
| Testing | Vitest (unit), Playwright (e2e / visual regression) |

See [TRD §02](./docs/Kinetic_Type_02_TRD.pdf) for the full stack rationale.

## Getting started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Type into the "Architecture spike" panel — it captures a
keystroke on the main thread, timestamps it, round-trips it through the Adaptive Engine worker,
and paints the result to canvas. That round trip is the latency-critical pipeline the entire
product is built on (TRD §08 budgets it at <5ms p95 once real work replaces this stub).

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writes changes |
| `npm run format:check` | Prettier, check only (used in CI) |
| `npm run typecheck` | `tsc` with no emit |

## Project structure

```
src/
  app/       Root shell (App.tsx)
  engine/    Adaptive Engine worker + shared main-thread <-> worker types
  render/    Canvas rendering components
  test/      Vitest setup
e2e/         Playwright end-to-end specs
docs/        The six source documents this build follows
```

Phase 1 adds `src/domains/` (lexers), `src/state/` (Zustand store), and a local persistence
layer under `src/data/` (Dexie schema, per Backend Schema §02).

## Firebase setup (needed starting Phase 4, not required yet)

The app is fully functional offline with zero Firebase config through Phase 3 — Firestore is only
a backup/sync mirror (TRD §01). When Phase 4 starts:

1. Go to the [Firebase console](https://console.firebase.google.com) and create a project named
   `kinetic-type` (or similar).
2. Add a Web app to the project; copy the config values it gives you.
3. Enable **Authentication → Sign-in method → Anonymous**, and Email/Password + Google as
   upgrade options.
4. Enable **Firestore Database** in production mode.
5. Copy `.env.example` to `.env.local` and fill in the values from step 2.
6. Repeat for separate `staging` and `prod` Firebase projects when ready (TRD §11 Environments).

This step needs your own Google account, so it's one you'll do yourself — ask if you want a
walk-through when Phase 4 comes up.

## Deployment

Hosting runs on [Vercel](https://vercel.com), not Firebase Hosting (TRD §05) — connect the GitHub
repo to a Vercel project and every push gets a preview URL; merges to `main` promote to
production automatically. No deploy credentials are needed in CI (TRD §11).
