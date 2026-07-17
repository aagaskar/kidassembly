# Developing BitBot

Notes for working on BitBot itself. For what the project *is* and how to run it, see the
top-level [`README.md`](../README.md); for the full curriculum design and pedagogy, see
[`DESIGN.md`](./DESIGN.md). Section references below (e.g. §5.5) point into `DESIGN.md`.

## Tech stack

React 18 + TypeScript, bundled with Vite. Tests run on Vitest; the end-to-end suite runs on
Playwright. No runtime dependencies beyond React — everything (the VM, assembler, compilers,
learning engine, storage) is hand-written in `src/`.

## Scripts

```sh
npm install
npm run dev       # dev server
npm run build     # tsc -b + vite build (typecheck + production bundle)
npm run preview   # serve the production build locally

npm test          # the full unit/property/golden-trace/content suite (Vitest)
npm run test:watch
npm run test:e2e  # Playwright end-to-end suite (needs browsers installed)
```

## Project layout

```
src/vm/        BitBot-8/16: types, pure step/run, decode, snapshots
src/asm/       two-pass assembler with child-friendly errors
src/minic/     MiniC: lexer/parser, BitBot-16 compiler with source maps, grader
src/realc/     sandboxed real-C interpreter (32-bit ints, printf/pixel/rand)
src/engine/    skills graph, FSRS scheduler, mastery store, placement,
               item grading, seeded RNG, profiles, IndexedDB storage
src/content/   lesson data (Units 0–15), skill graph + review generators,
               playground examples, Snake
src/ui/        React components: machine views, lesson player, item types,
               review session, placement, dashboard, playground
src/files/     save/open on local disk (FS Access API + fallback)
tests/         golden-trace, snapshot, grader, engine-simulation, compiler
               differential, content acceptance, Snake
e2e/           Playwright: profiles, placement, lessons, playground modes,
               Snake, real-C sandbox, export/import round-trip
```

## Content is data, not code

This is the central architectural bet, and it's worth preserving:

- **Lessons are plain objects** interpreted by the lesson player — no lesson is a bespoke
  component.
- **Review items are deterministic generators** (`seed → item`), so a given review is
  reproducible and parameterized (randomized starting states defeat memorization, §10).
- **Graded items compute their own expected answers by running the VM**, rather than storing
  a hardcoded key.

The payoff: content can never drift out of sync with machine semantics. The content
acceptance suite enforces this — for every graded item, the recorded solution must pass and
the starter/buggy original must fail.

## The machine is a pure function

The VM is `(state) → state`: deterministic, with no hidden mutation. That's what makes the
UI's step-back button an exact rewind, makes golden-trace testing possible, and makes the
compilers' differential tests meaningful (run the generated program, compare against
reference semantics). Keep it pure.

## What's implemented

Everything in the design doc through Phase 5:

- **BitBot-8 VM** (§3) — 256 bytes, registers A/PC/SP, the 17-instruction set, the
  memory-mapped 8×8 screen (boxes 128–191), and KEY/RANDOM/TICK cells.
- **BitBot-16** (§3.3) — the Unit-9 unlock: 4,096 bytes, 16-bit words and registers, a
  32×32 screen at 2048–3071, 3-byte instructions, the `LOADB`/`STOREB`/`LOADPB`/`STOREPB`
  byte variants, and SP-relative `LOADS`/`STORES` for stack frames.
- **Assembler** (§3.4) — labels, `.byte`/`.word`, char literals, comments, `label+offset`
  operands, and did-you-mean errors. Assembled bytes are always shown next to the source.
- **MiniC compiler** (Phase 4) — recursive descent over the C subset, emitting BitBot-16
  assembly with a source map; `*`/`/`/`%` compile to visible runtime loops. Differentially
  tested against reference semantics.
- **Learning engine** (Phase 2) — explicit knowledge graph (one skill per lesson, prereq
  gates, `subsumes` edges), mastery states, an FSRS-style spaced scheduler, layering credit
  (verified by simulation to keep review volume bounded), interleaved daily review, an
  adaptive placement diagnostic, and per-attempt telemetry. XP is awarded for mastery events
  and finished reviews only (§5.5).
- **Curriculum content** — 43 lessons across Units 0–15, spanning every item type
  (predict-state, trace-table, Parsons, fill-blank, bug-hunt, write-to-target, match, speed
  drills) and the misconception kill-list (§10): `M[a]` vs `M[M[a]]`, address vs value,
  two's complement.
- **Playground** (§8.1) — five progressively unlocked modes (BitBot-8, assembly, BitBot-16,
  MiniC with the live compiler view, real-C), with a parent-facing "unlock everything"
  toggle. Snake ships as a MiniC example.
- **Real-C sandbox** (Phase 5, option 1 from §7) — an in-browser interpreter for the same C
  subset with grown-up semantics, sandboxed by a step budget and an in-sandbox stack wall,
  with all memory access masked into one flat array.
- **Local profiles** (§8.2) — name + avatar, per-profile progress in IndexedDB (with
  localStorage migration and fallback), and one-file export/import of the complete state.
- **Parent dashboard** (§8.4) — read-only, local-only, computed on demand, behind a
  "type 7 × 8" grown-up gate (friction, not security — by design).

## Decision log — design-doc deviations worth knowing

- **MiniC restricts arrays/structs to global memory and `&` to globals.** BitBot-16 has no
  SP-to-A move, so locals have no takeable address. The real-C sandbox lifts both
  restrictions (locals live in a real stack).
- **The real-C sandbox is non-interactive** (run-to-completion with a console + pixel
  canvas). Interactive games live on BitBot-16, where KEY/TICK exist.
- **Skills are lesson-granularity graph nodes** (43 nodes) rather than 5–15 per unit;
  `subsumes` edges and parameterized review generators follow the §5 mechanics at that
  granularity.
- **Real C runs on a hand-written interpreter, not a wasm toolchain.** Off-the-shelf
  TCC/picoc wasm builds were not usable in this build environment; the interpreter keeps the
  zero-server, offline-friendly properties.

## Generating the README screenshots

The action shots in the README live in [`docs/screenshots/`](./screenshots/) and are
captured from the running app with Playwright (start `npm run dev`, then drive the app to
each state and screenshot it). Re-capture them whenever the UI changes materially so the
README keeps matching the product.
