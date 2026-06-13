# kidassembly — BitBot

A hardware-first CS curriculum for ages 8–12, running entirely in the browser.
Students learn the machine first: every abstraction (variables, pointers,
functions) is introduced as a name for something they've already manipulated
directly in **BitBot**, a simulated 8-bit computer (later upgraded to 16-bit)
with a memory-mapped pixel screen. See `docs/DESIGN.md` for the full
curriculum design.

## Status: Phases 1–5 implemented ✅

- **BitBot-8 VM** — 256 bytes of memory, 3 registers (A, PC, SP), the full
  17-instruction set, memory-mapped 8×8 screen (boxes 128–191), KEY/RANDOM/
  TICK cells. The VM is a pure function `(state) → state`: deterministic,
  step-back-able, golden-trace tested.
- **BitBot-16** (§3.3) — the Unit-9 unlock: 4,096 bytes, 16-bit words and
  registers, 32×32 screen at 2048–3071, 3-byte instructions, plus
  `LOADB`/`STOREB`/`LOADPB`/`STOREPB` byte variants and SP-relative
  `LOADS`/`STORES` for stack frames.
- **Assembler** (§3.4) — labels, `.byte`/`.word`, char literals, comments,
  `label+offset` operands, and child-friendly errors with did-you-mean
  ("I don't know a box called `cont` — did you mean `count`?"). Assembled
  bytes are always shown next to the source.
- **MiniC compiler** (Phase 4) — recursive descent over the C subset
  (char/int, pointers, arrays, structs, if/while/for, functions, casts,
  strings), emitting BitBot-16 assembly with a source map. The **compiler
  view** steps C and assembly in sync — `*p = 3;` visibly becomes `STOREP`.
  `*`/`/`/`%` compile to visible runtime loops. Differential-tested against
  reference semantics.
- **Learning engine** (Phase 2) — explicit knowledge graph (one skill per
  lesson, prereq gates, `subsumes` edges), mastery states, an FSRS-style
  spaced scheduler, **layering credit** (practicing a subsuming skill
  refreshes its ancestors — verified by simulation to keep review volume
  bounded), interleaved daily review sessions, an adaptive placement
  diagnostic at signup, and per-attempt telemetry. XP is awarded for
  mastery events and finished reviews only (§5.5).
- **Curriculum content** — 43 lessons across **Units 0–15**: bits → memory
  boxes → fetch/decode/execute → arithmetic and first pixels → the
  assembler → loops → pointers-in-assembly → the stack → the C bridge →
  MiniC variables/control flow/functions/pointers/arrays/strings/structs →
  capstone game loop and the real-C travel guide. Item types: predict-state,
  trace-table, Parsons, fill-blank, bug-hunt, write-to-target (randomized
  initial states defeat hardcoding), match, speed drills with the
  misconception kill-list (§10) drills (`M[a]` vs `M[M[a]]`, address vs
  value, two's complement). Every graded item is machine-verified by the
  content test suite: the recorded solution must pass, the starter/buggy
  original must fail.
- **Playground** (§8.1) — five progressively unlocked modes: BitBot-8
  (poke boxes, paint pixels), assembly editor, BitBot-16, MiniC with the
  live compiler view, and the real-C sandbox. **Snake** ships as a MiniC
  example — W/A/S/D steering through the KEY box, pacing via TICK.
  A parent-facing "unlock everything" toggle lives in the dashboard.
- **Real-C sandbox** (Phase 5, option 1 from §7) — an in-browser
  interpreter for the same C subset with grown-up semantics: 32-bit ints,
  a real stack (`&` works on locals), `printf`/`pixel`/`rand`. Sandboxed by
  construction: hostile programs hit a step budget or the in-sandbox stack
  wall; all memory access is masked into one flat array. (Off-the-shelf
  TCC/picoc wasm builds were not usable in this build environment; the
  interpreter keeps the zero-server, offline-friendly properties.)
- **Local profiles** (§8.2) — name + avatar (no passwords; a convenience,
  not a security boundary), per-profile progress in IndexedDB (with
  localStorage migration and fallback), and one-file export/import of the
  complete state: settings, skill states with FSRS schedules, telemetry, XP.
- **Parent dashboard** (§8.4) — read-only, local-only, computed on demand:
  current unit, mastered/in-progress/locked counts, 7/30-day activity,
  review health, struggle list, milestones, profile export. Behind a
  "type 7 × 8" grown-up gate (friction, not security — by design).

No server, no accounts: everything is client-side. No children's data is
collected at all.

## Run it

```sh
npm install
npm run dev       # dev server
npm test          # 324 unit/property/golden-trace/content tests
npm run test:e2e  # Playwright end-to-end suite (needs browsers installed)
npm run build     # typecheck + production build
```

## Layout

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

Content is data, not code: lessons are plain objects interpreted by the
lesson player, review items are deterministic generators (`seed → item`),
and graded items compute their expected answers by running the VM — so
content can never drift out of sync with machine semantics.

## Design-doc deviations worth knowing (§ decision log)

- MiniC restricts arrays/structs to global memory and `&` to globals —
  BitBot-16 has no SP-to-A move, so locals have no takeable address. The
  real-C sandbox lifts both restrictions (locals live in a real stack).
- The real-C sandbox is non-interactive (run-to-completion with console +
  pixel canvas); interactive games live on BitBot-16, where KEY/TICK exist.
- Skills are lesson-granularity graph nodes (43 nodes) rather than 5–15
  per unit; `subsumes` edges and parameterized review generators follow
  the §5 mechanics at that granularity.
