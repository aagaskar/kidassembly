# kidassembly — BitBot

A hardware-first CS curriculum for ages 8–12, running entirely in the browser.
Students learn the machine first: every abstraction (variables, pointers,
functions) is introduced as a name for something they've already manipulated
directly in **BitBot**, a simulated 8-bit computer with a memory-mapped pixel
screen. See `docs/DESIGN.md` for the full curriculum design.

## Status: Phase 1 (walking skeleton) ✅

- **BitBot-8 VM** — 256 bytes of memory, 3 registers (A, PC, SP), the full
  17-instruction set, memory-mapped screen (boxes 128–191), KEY/RANDOM/TICK
  cells. The VM is a pure function `(state) → state`: no hidden state, fully
  deterministic (seeded RNG), which makes step-back and golden-trace testing
  trivial.
- **Visualization** — 16×16 memory grid with four view modes (decimal, binary
  lights, ASCII, color), registers with binary lamps, the 8×8 screen, and a
  plain-language decode of the instruction at PC ("Copy what's in box 7 into A").
- **Controls** — single-step, step **backward**, run with a speed slider.
- **Lesson player** — 10 lessons covering Units 0–2 (bits → memory boxes →
  fetch/decode/execute), with predict-state, fill-blank (run-and-assert against
  multiple initial states), quiz, bit-toggle, and parameterized drill items.
  Prediction-first stepping: the student locks in a prediction, then watches
  BitBot do it.
- **Playground** — free-play sandbox: poke any memory cell, paint pixels
  (bidirectional — the screen IS memory), run examples, save/load programs
  (plain text) and full machine snapshots (versioned JSON) to local disk.
- **Progress** — lesson completion in localStorage. (The mastery/FSRS engine
  is Phase 2.)

No server, no accounts: everything is client-side.

## Run it

```sh
npm install
npm run dev     # dev server
npm test        # VM golden traces, snapshot round-trip, grader tests
npm run build   # typecheck + production build
```

## Layout

```
src/vm/        BitBot-8: types, pure step/run, decode, snapshots
src/engine/    lesson step types, item grading, seeded RNG, progress store
src/content/   lesson data (Units 0–2) and playground examples
src/ui/        React components: memory grid, screen, registers, lesson player, playground
src/files/     save/open on local disk (FS Access API + fallback), program text format
tests/         golden-trace, snapshot round-trip, grader property tests
```

Content is data, not code: lessons are plain objects (`src/content/lessons.ts`)
interpreted by the lesson player, so new lessons don't touch engine code.
Graded items compute their expected answers by running the VM, so items can
never drift out of sync with machine semantics.

## Roadmap (from the design doc)

- **Phase 2** — knowledge graph, mastery states, FSRS spaced review, layering
  credit, placement diagnostic, local profiles with file export/import.
- **Phase 3** — assembler with child-friendly errors, Parsons/trace/bug-hunt/
  write-to-target items, content through Unit 8, compiler view, parent dashboard.
- **Phase 4** — BitBot-16 and the MiniC compiler with synced C↔assembly stepping.
- **Phase 5** — real-C sandbox and capstone projects (Snake!).
