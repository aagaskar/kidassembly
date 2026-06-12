# Hardware-First CS Curriculum for Ages 8–12
## Design Document for Web App Implementation

**Status:** v1 design for review. Intended as input to Claude Code.

**Core thesis:** Teach the machine first. Every abstraction (variables, types, pointers, functions) is introduced as a *name for something the student has already manipulated directly in a simulated processor*. By the time C arrives, pointers are syntax for a familiar operation, not a new concept.

---

## 1. Overview

The curriculum runs in a single-page web app containing:

1. **BitBot** — a deterministic, visual, simulated 8-bit computer (later upgraded to 16-bit) with a memory-mapped pixel screen.
2. **A lesson engine** — mastery-based progression over an explicit knowledge graph, with spaced retrieval practice (FSRS-style scheduling) and auto-graded, parameterized exercises.
3. **A toolchain that grows with the student** — machine code → assembler → "compiler view" (C side-by-side with generated assembly) → MiniC (a C subset compiled to BitBot) → real C in a sandbox.
4. **Playground mode and local profiles** — a free-play sandbox for tinkering with the machine outside the curriculum (programs and full memory snapshots save/load to local disk), and multiple per-device student profiles whose complete state exports/imports as a single file. A read-only parent dashboard sits on top of the same local data. No server, no accounts (§8).

The single most important pedagogical mechanic is the **compiler view**: when C is introduced, every C construct is shown next to the BitBot assembly it compiles to, and the student can step through either side with both highlighted in sync. C is framed explicitly as "a faster way to write what you already write."

The single most important *motivational* mechanic is the **memory-mapped screen**: a region of memory whose bytes are pixels. Storing a value to address 130 lights a pixel. This makes memory manipulation visible and fun from Unit 3 onward, and it makes pointers *useful* (a pointer that walks the framebuffer draws a line) rather than an academic hurdle.

Target session length: 15–25 minutes. Estimated total: 60–120 hours of student time to complete through the C units. (Low confidence on totals; calibrate from pilot telemetry.)

---

## 2. Evidence base and design principles

These are the principles the app's mechanics are built on, with sources you can verify. Confidence annotations are mine; check the citations.

**P1. Explicit instruction with worked examples beats discovery for novices.** Every new skill is introduced with a fully worked example, then *faded* examples (student fills in progressively more), then independent problems. Sources: Sweller & Cooper (1985) on the worked-example effect; Kirschner, Sweller & Clark (2006), "Why Minimal Guidance During Instruction Does Not Work." High confidence for novices; note the published rebuttal (Hmelo-Silver, Duncan & Chinn, 2007) argues scaffolded inquiry is not "minimal guidance" — the design here sidesteps the debate by being explicit throughout.

**P2. Retrieval practice, not re-reading.** Lessons are short; the bulk of time is answering questions and writing code from memory. Sources: Roediger & Karpicke (2006); meta-analysis Adesope, Trevisan & Sundararajan (2017). High confidence in general; direct evidence in programming education is thinner — treat the transfer as plausible, not proven.

**P3. Spacing.** Each skill gets scheduled reviews at expanding intervals via an FSRS-style scheduler (open-source algorithm; benchmarked against SM-2 on large Anki datasets — see the open-spaced-repetition GitHub org for the benchmark data). High confidence on spacing generally (Cepeda et al., 2006 meta-analysis); the specific FSRS parameters were fit on flashcard data, not coding exercises, so expect to retune.

**P4. Mastery before progression, via an explicit prerequisite graph.** A student does not see skill B until its prerequisites are mastered, and "mastered" means demonstrated performance (accuracy and, for foundational skills, speed), not lesson completion. Sources: Bloom (1968) mastery learning; Bloom (1984) "2 sigma." Caution: the 2-sigma effect size is widely considered inflated (modern tutoring meta-analyses find large but smaller effects, e.g., Nickow, Oreopoulos & Quan 2020 working paper on tutoring ~0.37 SD); the *direction* is robust, the magnitude is not.

**P5. Implicit review through layering.** When skill B subsumes skill A (writing a loop subsumes writing a jump), correct performance on B refreshes A's review schedule. This is the mechanism The Math Academy Way describes for compressing review load (they discuss "encompassing" relationships; verify terminology against the book — I'm confident about the mechanism, less about their exact label). Without this, SRS review volume grows unsustainably.

**P6. Interleaving in review sessions.** Daily review mixes skills rather than blocking by topic. Sources: Rohrer & Taylor (2007); Rohrer, Dedrick & Stershic (2015) for math classroom evidence. Moderate-to-high confidence; effect sizes vary.

**P7. Cognitive load management.** One new element per lesson; uniform instruction encoding; consistent visual layout; no split attention (explanations annotate the simulator directly rather than living in a separate panel). Source: Sweller's cognitive load theory (see Sweller, Ayres & Kalyuga, 2011 book for the survey). Also the **expertise reversal effect** (Kalyuga et al., 2003): scaffolds that help novices hurt intermediates, so worked-example density must fade with measured mastery, not stay constant.

**P8. Parsons problems as a low-load practice format.** Reordering scrambled code lines teaches structure with less typing and less floundering than write-from-scratch, and evidence suggests comparable learning in less time (Parsons & Haden, 2006; Ericson, Margulieux & Rick, 2017; Ericson et al. 2022 review). Especially valuable for 8–10-year-olds with limited typing. Moderate confidence.

**P9. Teach against known misconceptions ("notional machine" research).** Novice bugs cluster around a wrong model of the machine: believing the computer understands intent (Pea's 1986 "superbug"), confusing a variable's name/address/value, misunderstanding assignment direction, thinking multiple values live in one variable. Sources: du Boulay (1986); Pea (1986); Sorva (2013) survey on notional machines and program visualization. This curriculum's whole premise is that building the notional machine *first* prevents these; that premise is plausible and consistent with Sorva's review but not directly tested at this age — flag as the key bet of the project.

**Deliberately excluded:** learning-styles matching (debunked — Pashler et al., 2008), discovery-first pedagogy for novices, engagement-time-based gamification (XP is awarded only for demonstrated mastery and completed reviews, never for time-on-site or streak mechanics that reward showing up without performing).

**Honest unknowns:** (a) Almost no direct research exists on machine-level-first instruction for ages 8–12; Little Man Computer-style machines are typically used at 14+. CS Unplugged shows binary representation works well at 7+, which supports the early units. The 8–9 band is the risk zone — mitigations in §9. (b) Retrieval/spacing research is mostly on declarative knowledge; coding is partly procedural. The design hedges by making review items small and skill-targeted rather than full programs.

---

## 3. The notional machine: BitBot

### 3.1 Design goals

- Small enough to hold entirely in a child's head (every state element visible on one screen).
- Binary-honest (bytes are 8 lights; no decimal-only fiction) but with decimal shown alongside everywhere.
- Contains the *seed of every C concept*: addresses (pointers), indirect addressing (dereference), a stack (function calls/locals), memory-mapped I/O (pointers are useful), uniform memory (types are interpretations).

### 3.2 BitBot-8 (Units 0–8)

- **Memory:** 256 bytes, addresses 0–255, displayed as a 16×16 grid of cells. Each cell shows its value (toggle: decimal / binary lights / ASCII / color swatch).
- **Registers:** `A` (accumulator, 8-bit), `PC` (program counter), `SP` (stack pointer, introduced in Unit 7). Deliberately no status flags: conditional jumps test A's current value directly, so there is zero hidden state — everything a trace requires is visible in three registers and the grid.
- **Execution:** fetch–decode–execute animated visibly: PC highlights the cell being fetched, the instruction decodes into plain language ("ADD the number in box 40 to A"), then state changes animate. Speed slider from single-step to instant.

**Memory map (fixed, taught explicitly):**

| Range | Purpose |
|---|---|
| 0–127 | Program + data (programs load at 0) |
| 128–191 | Screen: 8×8 pixels, one byte each, value 0–15 = palette color |
| 192 | KEY: code of last key pressed (0 = none); writing 0 clears it |
| 193 | RANDOM: reads return a random byte |
| 194 | TICK: increments 10×/second (for simple timing) |
| 195–255 | Free RAM; stack grows downward from 255 |

**Instruction set (all instructions 2 bytes: opcode, operand; HALT's operand ignored):**

| Op | Mnemonic | Effect | Introduced |
|---|---|---|---|
| 0 | HALT | stop | Unit 2 |
| 1 | LOADC n | A ← n | Unit 2 |
| 2 | LOAD a | A ← M[a] | Unit 2 |
| 3 | STORE a | M[a] ← A | Unit 2 |
| 4 | ADD a | A ← A + M[a] (wraps mod 256; wraparound shown visually) | Unit 3 |
| 5 | SUB a | A ← A − M[a] | Unit 3 |
| 6 | JUMP a | PC ← a | Unit 5 |
| 7 | JZ a | if A = 0: PC ← a | Unit 5 |
| 8 | JNEG a | if A's top bit is 1 (negative in two's complement): PC ← a | Unit 5 (after two's complement mini-lesson) |
| 9 | LOADP a | A ← M[M[a]] ("follow the arrow") | Unit 6 |
| 10 | STOREP a | M[M[a]] ← A | Unit 6 |
| 11 | CALL a | push PC+2; PC ← a | Unit 7 |
| 12 | RET | pop → PC | Unit 7 |
| 13 | PUSH | M[SP] ← A; SP ← SP−1 | Unit 7 |
| 14 | POP | SP ← SP+1; A ← M[SP] | Unit 7 |
| 15 | PLUSONE a | M[a] ← M[a]+1; A ← the new value | Unit 5 |
| 16 | MINUSONE a | M[a] ← M[a]−1; A ← the new value | Unit 5 |

PLUSONE/MINUSONE leave their result in A like every other value-producing instruction, which makes the two core loop idioms read naturally: `MINUSONE count` / `JZ done` (countdown), and `PLUSONE ptr` / `SUB last` / `JNEG loop` (bounded pointer walk). The child-friendly names are deliberate — lesson prose can say "plus one the counter" and mean exactly what the instruction says.

Design rationale (decision now resolved — see §11): **memory-indirect addressing (LOADP/STOREP) instead of an index register.** It maps one-to-one onto pointer dereference ("box 12 holds an address; go where it points"), keeps the machine one-handed (a single data register to trace), and makes "a pointer is a plain number in a plain box" structurally unavoidable — which is the curriculum's thesis. The cost was pointer-increment verbosity (LOAD/ADD/STORE on the pointer cell); PLUSONE/MINUSONE buy most of that back for two opcodes, no new register, and no new addressing mode.

Opcode numbers are deliberately small and memorable because in Unit 3 students briefly write raw numeric machine code (a few programs only — enough to *earn* the assembler, not enough to be tedious).

### 3.3 BitBot-16 (Units 9+, the C era)

When MiniC arrives, BitBot "grows up": 16-bit words for A and addresses, 4,096 bytes of memory, 32×32 screen, same instruction concepts plus `LOADB`/`STOREB` byte variants and `LOADS off` / `STORES off` (SP-relative load/store: A ↔ M[SP+off]). The SP-relative pair exists for the compiler — stack-frame locals and parameters become base+offset accesses — and is taught in Unit 11 when frames are visualized, framed as "tools the grown-up machine gives the compiler to find a frame's boxes." Without them, every local access compiles to a 4–5 instruction frame-pointer dance through memory, which strains the compiler view's legibility. Narratively the whole upgrade is framed as something the student unlocks. Purpose: makes `char` (1 byte) vs `int` (2 bytes) real, so `int* p; p+1` visibly moves 2 bytes — pointer arithmetic scaling becomes an observed fact rather than a rule. This is a significant design decision; the alternative (stay 8-bit, only have `char`) was considered and rejected because it forfeits the types-have-sizes lesson. Confirmed as core (decision log, §11) — Phase 4 and Units 9+ assume it.

### 3.4 Assembly language (Unit 4+)

Line-oriented, labels for addresses, `.byte` directive for data, comments with `;`. Example the student meets in Unit 6:

```
        LOADC 128      ; address of first pixel
        STORE ptr
loop:   LOADC 3        ; color 3
        STOREP ptr     ; paint where ptr points
        PLUSONE ptr    ; move ptr to the next box (new value lands in A)
        SUB last       ; have we passed the screen?
        JNEG loop
        HALT
ptr:    .byte 0
last:   .byte 192
```

The assembler shows the assembled bytes next to the source so the "names are just numbers" lesson never goes stale.

---

## 4. Curriculum map

Each unit decomposes into ~5–15 atomic skills (knowledge-graph nodes). Listed here at unit granularity with the key skills and the *misconception each unit is built to kill*. Age-band pacing notes in §9.

### Unit 0 — Bits and representation (no machine yet)
Switches/lights as 0/1; counting in binary (1–4 bits, lots of drill to automaticity); bytes as 8 lights; the punchline lesson: *the same byte* shown as a number, a letter (mini-ASCII table), and a color. Skill drills: binary↔decimal for 0–15 (timed, automaticity target), "what's the biggest number in N bits?"
**Kills:** "computers contain numbers/letters/pictures as different stuff." Everything is bits; meaning is interpretation. This is the type-system seed.

### Unit 1 — Memory: boxes with addresses
The 16×16 grid. Address vs. contents, hammered relentlessly: "what is IN box 12?" vs "what is the ADDRESS of the box holding 99?" Treasure-hunt exercises: "box 5 holds 17; box 17 holds 3; what do you find by following twice?" — this *is* pointer chasing, taught as a game before any code exists.
**Kills:** address/value confusion (the central pointer bug, attacked 8 units early).

### Unit 2 — The machine wakes up
Fetch–decode–execute with 4 instructions (HALT, LOADC, LOAD, STORE). Students single-step given programs and predict each state change before it animates (prediction-first stepping is the core lesson interaction throughout). The von Neumann punchline: the program *is in the boxes too* — a program that STOREs into its own instructions, shown as a curiosity ("programs are data").
**Kills:** the machine as intent-reader. It does exactly one dumb step at a time (anti-"superbug").

### Unit 3 — Arithmetic, machine code, and first pixels
ADD/SUB; write 3–4 tiny programs in raw numeric machine code (deliberately mildly painful); first STORE to address 130 lights a pixel — screen introduced. Wraparound at 255 observed and named.
**Kills:** nothing new; builds appetite for Unit 4.

### Unit 4 — The assembler: names for numbers
Mnemonics, then labels. Explicit framing: "you invented a tool that translates names to numbers; every language above this is more of the same." Labels-for-data ARE variables — say so out loud, then keep calling them labels until C.
**Kills:** "variables are magic containers the language provides." A variable is an address with a nickname.

### Unit 5 — Going in circles: jumps, loops, decisions
JUMP, JZ; two's complement mini-lesson (negative numbers as "what do you add to get zero," with the wraparound odometer visual); JNEG; PLUSONE/MINUSONE and the countdown idiom (`MINUSONE count` / `JZ done` — the freshly decremented value lands in A, so the test reads naturally); counted loops; condition-at-the-top idiom. Heavy tracing practice with loop tables (iteration-by-iteration state grids — externalize the trace, then fade the scaffold).
**Kills:** off-by-one and loop-boundary errors get named and drilled here, on 5-line programs, where they're cheap.

### Unit 6 — Arrows: indirect addressing
LOADP/STOREP. Pointer-walking the framebuffer: draw rows, then rectangles (nested loops). Copy a block of memory. The word "pointer" is introduced HERE, in assembly, as the name of "a box holding an address."
**Kills:** dereference confusion — `M[a]` vs `M[M[a]]` drilled as distinct, automatized skills.

### Unit 7 — Reusable code: CALL, RET, and the stack
Why JUMP back doesn't work (return-to-where?); the stack as the machine's to-do pile; PUSH/POP for saving A; calling conventions kept to "argument in A, result in A." Visualized stack region with depth animation; deliberately overflow the stack once (recursion teaser) and watch it eat the program.
**Kills:** functions-as-magic. A call is a jump that remembers.

### Unit 8 — The bridge: inventing a language
Capstone-ish unit. Students read short C snippets and match them to equivalent assembly they've already written (matching/Parsons items, no C writing yet). The compiler view ships here: type `x = x + 1;`, watch `LOAD x / ADD one / STORE x` appear. Framing: "people got tired of writing the right side."
**Kills:** "C is a different world." It's shorthand.

### Unit 9 — MiniC: variables, types, expressions
Declarations as "reserve a box and nickname it" — the compiler view shows the reserved address. Types as sizes-plus-interpretation: `char` = 1 box, `int` = 2 boxes (BitBot-16 arrives here); the Unit-0 lesson reprised in C: print the same bytes as number and letter. Assignment direction drilled (`x = y` copies right into left — trace items where students predict both boxes after).
**Kills:** assignment-as-equation; multiple-values-in-one-variable.

### Unit 10 — Control flow in C
`if/else`, `while`, `for`, comparisons. Every construct shown compiling to the jumps they know. `for` introduced as `while` shorthand (compiler view shows identical output). Loop-table tracing reprised in C.

### Unit 11 — Functions
Parameters and locals as boxes in the stack frame, visualized live; BitBot-16's SP-relative `LOADS`/`STORES` arrive here as "the tools the compiler uses to find a frame's boxes" (§3.3); return values; scope as "frame dies, boxes recycled" — watch a dangling local's box get overwritten. Recursion (factorial, drawing nested squares) with the stack visualization doing the heavy lifting.
**Kills:** scope-as-incantation; recursion-as-mystery.

### Unit 12 — Pointers in C (the payoff unit)
`&` = "address of" (a number you've seen since Unit 1); `*` = LOADP/STOREP with new clothes — compiler view literally shows `*p = 3;` becoming STOREP. Pointer arithmetic with sizes (`int*` steps by 2, observed in the memory grid). `char* screen = (char*)128;` — the student's old friend the framebuffer, now in C. Swap-two-variables via pointers; why `swap(a, b)` without pointers fails (trace it — the frames make it obvious).
**Expected outcome:** this unit should feel EASY. If item-level error rates here are not markedly below typical intro-C pointer error rates, the curriculum's core bet failed — instrument accordingly.

### Unit 13 — Arrays and strings
Arrays as contiguous boxes; `a[i]` ≡ `*(a+i)` shown in compiler view; array-pointer relationship demystified by construction. Strings as char arrays with a 0 at the end (find-the-end loop; strlen written by hand). Buffer overrun demonstrated *on purpose*: write past an array, corrupt a neighbor, watch the screen glitch — memory safety as visceral experience.

### Unit 14 — Structs and memory layout
Struct as "boxes glued together"; field access as base+offset (compiler view shows the constant offsets); arrays of structs; a sprite struct (x, y, color) driving screen objects.

### Unit 15 — Capstone projects (real C, sandboxed)
Graduated project menu on BitBot-16 first (Snake on the 32×32 screen — input, sprites, collision, the whole curriculum in one game), then "real C" mode: same programs ported to a sandboxed standard C environment with a provided tiny graphics library mimicking the BitBot screen API, plus printf/scanf. Diff lesson: what's different in real C (sizes, the heap exists, the OS exists) framed as a travel guide, not a syllabus.

**Optional advanced strand (post-15):** hex notation (natural once bytes are old friends), bitwise ops and masks (sprite transparency!), simple malloc/free on a visualized heap, how the assembler/compiler could be written in C (bootstrapping teaser).

---

## 5. Lesson and practice item design

### 5.1 Lesson template (every skill node)

1. **Hook** (≤30 s): a question or one-line goal, often "predict what this does."
2. **Worked example** (1–3 min): narrated, animated on the simulator. Explanations annotate the artifact in place (no split attention).
3. **Faded examples** (2–4 items): same task shape, student supplies progressively more steps.
4. **Independent items** until mastery criterion (below).
5. Skill enters the spaced-review pool.

### 5.2 Item types (all auto-graded)

| Type | What the student does | Grading |
|---|---|---|
| Predict-state | Given code + state, predict a register/cell/pixel after N steps | exact match |
| Trace-table | Fill loop-iteration table | per-cell |
| Parsons | Reorder scrambled lines (with 1–2 distractors at higher levels) | order + distractor exclusion |
| Fill-blank | Faded example with 1–3 blanks | per-blank, accepts equivalents |
| Bug hunt | Program + intended behavior; find/fix the bug | run-and-assert after fix |
| Write-to-target | "Make memory/screen look like THIS" | run program, assert final state; multiple randomized initial states defeat hardcoding |
| Match (Unit 8+) | Match C lines to assembly blocks | exact |
| Speed drill | Foundational micro-skills (binary↔decimal, opcode effects, M[a] vs M[M[a]]) | accuracy + latency |

Write-to-target with screen goals is the workhorse creative format: unambiguous to grade, open-ended in solution path, intrinsically motivating ("draw the flag," "make the checkerboard," "animate the bouncing dot").

### 5.3 Item parameterization

Every item is a template with randomized parameters (addresses, constants, patterns) and a solution checker, not a static question — so reviews never repeat verbatim and answer-memorization is impossible. This mirrors Math Academy's generated-problem approach and is a hard requirement for the SRS to measure skill rather than item memory.

### 5.4 Mastery and scheduling model

- Each skill tracks a mastery state from item outcomes. Initial mastery: ~3 consecutive independent successes (tunable per skill), with latency thresholds only on designated automaticity skills (Unit 0 conversions, instruction semantics, M[a]/M[M[a]] discrimination).
- FSRS-style scheduler assigns each mastered skill a review due-date; daily session = due reviews (interleaved, ~5–10 items) + new learning.
- **Layering credit:** the skill graph marks "subsumes" edges; success on a subsuming skill's item counts as a successful review of subsumed skills (e.g., a Unit 10 loop-trace item refreshes Unit 5 jump semantics). This is what keeps review volume sane.
- Repeated failure on review demotes the skill to relearning (worked example replays in faded form).
- **Placement diagnostic** at signup: adaptive 10–20 item probe (binary? typing? read code before?) seeds the graph so a 12-year-old with Scratch experience doesn't crawl through Unit 0.

### 5.5 What XP rewards

Mastery events and completed review sessions only. No streaks-for-streaks, no time-on-site rewards, no decorative purchases gated on engagement. Cosmetic unlocks (palette colors, BitBot "skins") tied to unit completion are fine.

---

## 6. Data model (for Claude Code)

Content is data, not code. Suggested shapes (adjust freely):

```typescript
interface Skill {
  id: string;                  // "u06.pointer_walk_row"
  unit: number;
  title: string;
  prereqs: string[];           // hard gates
  subsumes: string[];          // layering-credit edges (see §5.4)
  automaticity: boolean;       // latency-gated?
  lesson: LessonScript;        // hook + worked example + faded sequence
  itemTemplates: ItemTemplateRef[];
  masteryRule: { consecutive: number; maxLatencyMs?: number };
}

interface ItemTemplate {
  id: string;
  type: "predict" | "trace" | "parsons" | "fillblank" | "bughunt"
      | "target" | "match" | "drill";
  generate(seed: number): ItemInstance;   // deterministic from seed
  grade(instance: ItemInstance, answer: Answer): Grade;
}

interface StudentSkillState {
  skillId: string;
  mastery: "locked" | "learning" | "mastered" | "relearning";
  fsrs: { stability: number; difficulty: number; due: string };
  history: Attempt[];          // outcome + latency, for telemetry
}
```

`LessonScript` is a sequence of steps, each pairing prose/audio with simulator directives (`loadProgram`, `step`, `highlightCell`, `pauseForPrediction(expected)`). This keeps lessons authorable as YAML/JSON without touching engine code.

---

## 7. App architecture and implementation phases

**Stack recommendation:** TypeScript + React (or Svelte); 100% client-side through Phase 4 — no server or accounts; multiple local profiles persisted in IndexedDB, with full save/load to files on disk (§8). The VM is a pure function `(state, instruction) → state` with no I/O side effects (screen/keyboard are just memory), which makes it trivially testable and makes time-travel debugging (step BACKWARD — pedagogically valuable, kids love it) nearly free.

**Phase 1 — Walking skeleton.** BitBot-8 VM + memory-grid/register/screen visualization + single-step/run/speed/step-back + lesson player + Playground v1 (free run, memory poking, screen painting, program/snapshot save-load to disk — §8.1, §8.3) + ~10 hand-authored lessons covering Units 0–2 with predict-state and fill-blank items. *Acceptance: a child can complete Units 0–2 end-to-end; VM passes a golden-trace test suite (programs + expected state sequences); a snapshot saved to disk reloads to byte-identical machine state (round-trip hash test).*

**Phase 2 — Learning engine.** Knowledge graph, mastery states, FSRS scheduling, layering credit, daily-session composer (reviews + new), placement diagnostic, item-template parameterization, local profiles with file export/import (§8.2). *Acceptance: simulated students (scripted answer policies) produce sane schedules; review volume stays bounded as graph grows (layering credit verified by simulation); a profile exported on one browser imports losslessly on a clean browser (round-trip test on skill states and schedules).*

**Phase 3 — Toolchain & content to Unit 8.** Assembler with labels, error messages written for children ("I don't know a box called `cont` — did you mean `count`?"), Parsons/trace/bughunt/write-to-target graders, content through Unit 8 including compiler view (hand-mapped C↔asm pairs are fine here; the real compiler comes next). Playground gains the assembly editor. Parent dashboard v1 ships here (§8.4).
*Acceptance: write-to-target items grade correctly against randomized initial states; compiler view steps both panes in sync; dashboard aggregates reconcile exactly with raw telemetry (computed on demand, never cached).*

**Phase 4 — MiniC.** BitBot-16; a MiniC compiler (subset: char/int, pointers, arrays, structs, if/while/for, functions, no preprocessor, no heap initially) emitting BitBot-16 assembly with source-map for the synced stepping. This is the largest engineering risk in the project — a recursive-descent compiler for this subset is a known quantity, but budget real time for the source-map quality, because synced stepping IS the product. Content Units 9–14. Playground gains BitBot-16 and the MiniC editor.
*Acceptance: a corpus of MiniC programs compiles and runs with correct semantics (differential-test against the same programs run through a reference C compiler where the subset overlaps); stepping highlights the correct C line for every instruction.*

**Phase 5 — Real C sandbox + capstones.** Options, in my order of preference:
1. **C interpreter or small compiler compiled to WebAssembly, in-browser** (e.g., a picoc-class interpreter or TCC targeted at wasm). Double sandbox (wasm + interpreter), zero server cost, offline-friendly. Uncertainty: the maturity of off-the-shelf TCC/picoc wasm builds varies; have Claude Code evaluate current options at build time rather than trusting this doc.
2. **Server-side compile + execute** in a locked-down container (no network, seccomp, rlimits, 1-second CPU cap), godbolt-style. Most "real," adds infrastructure and abuse surface.
3. Full clang-in-wasm toolchains exist but are heavyweight (large downloads); probably overkill.

Provide a tiny graphics/input library shimming the BitBot screen API so capstone games port across with minimal diff. *Acceptance: hostile test programs (infinite loops, huge allocations, out-of-bounds writes) cannot affect anything outside the sandbox; Snake runs.*

**Cross-phase:** golden-trace tests for the VM, property tests for graders (a correct reference solution must always pass; known-wrong solutions must fail), and telemetry events (item outcomes + latencies, per-skill error rates) stored locally and exportable — you'll want Unit 12's error rates (see §4) to judge the core bet.

---

## 8. Playground mode and local persistence

### 8.1 Playground (sandbox)

A free-play mode reachable from the home screen at any time: the same simulator UI the lessons use, with no grading, no scheduler, and no script.

- **Machine chooser:** BitBot-8, plus BitBot-16 once unlocked (policy below).
- **Direct memory editing:** click any cell and type a value; paint pixels directly on the screen and watch the corresponding bytes change. Bidirectional editing is the point — the screen IS memory, and the playground is where that fact becomes muscle memory.
- **Code editing at whatever level the student has reached:** raw machine-code grid, assembly editor (post-Unit 4), MiniC editor (post-Unit 9), with run/step/step-back/speed identical to lesson mode.
- **Save/load to local disk** (§8.3): programs as plain-text files, full machine snapshots (all memory + registers) as JSON.
- An **examples shelf** of openable programs and snapshots (pixel art, a bouncing ball, a screen-flash "song"), seeded by us and extendable by importing files from anyone.

Unlock policy — my recommendation, overridable by a settings toggle ("unlock everything") intended for parents/experts: playground tools appear as the curriculum introduces them. This isn't about restricting exploration; free tinkering *after* explicit instruction is motivationally valuable and doesn't conflict with the explicit-instruction stance, because the playground isn't the instruction channel. It's about not confronting an 8-year-old with an assembler they can't read yet, and not spoiling the BitBot-16 unlock moment. Confirmed: progressive unlock with the toggle (decision log, §11).

A non-obvious payoff: snapshots double as an authoring format. A parent, teacher, or future content author can hand-craft a starting memory state plus a note ("fix my draw loop") and share the file — which is exactly the bug-hunt/write-to-target item shape. Keep the snapshot schema identical between playground saves and item definitions so this stays true.

### 8.2 Local profiles and state files

Multiple students share a device via local profiles: a picker on launch, name + avatar, no passwords (this is a home-device convenience, not a security boundary — say so in the UI).

- All state lives client-side. Prefer IndexedDB over localStorage: localStorage's ~5 MB ceiling gets uncomfortable once per-attempt telemetry accumulates.
- **Export profile** writes one versioned JSON file to disk; **import** offers "replace existing" or "add as new profile." No merge semantics — merging is a tar pit, and the real use cases (moving devices, backups, two households) don't need it.
- The profile file contains everything: settings, input mode, skill states and FSRS schedules, telemetry, and playground saves. One file = one student, portable across devices and browsers.
- A privacy consequence worth advertising: no server and no accounts means no children's data is collected at all, which sidesteps most COPPA-style obligations by design. (Not legal advice; verify before any commercial distribution.)

### 8.3 File formats

```typescript
interface ProfileFile {
  format: "bitbot-profile"; formatVersion: 1;
  exportedAt: string; appVersion: string;
  profile: { name: string; avatar: string; settings: Settings };
  skills: StudentSkillState[];          // §6
  telemetry: Attempt[];
  playgroundSaves: { programs: ProgramFile[]; snapshots: SnapshotFile[] };
}

interface SnapshotFile {
  format: "bitbot-snap"; formatVersion: 1;
  machine: "bb8" | "bb16";
  memory: number[];                      // full image (base64 acceptable for bb16)
  registers: { A: number; PC: number; SP: number };   // no flags by design (§3.2)
  notes?: string;                        // author's message: "can you fix my draw loop?"
  sourceProgram?: ProgramFile;           // optional provenance
}
```

Programs save as **plain text** (`.bb8.asm`, `.minic`) so they open in any editor and can be emailed or printed; snapshots and profiles are `.json` with the format/version envelope above. Version the formats from day one and key migrations on `formatVersion` — cheap now, painful retrofitted.

File I/O: use the File System Access API (`showSaveFilePicker` / `showOpenFilePicker`) where available, with anchor-download and `<input type="file">` as the fallback. My recollection is that the full picker API remains Chromium-only (not Firefox/Safari) — moderate confidence; have Claude Code feature-detect at build time rather than trusting this, and treat the fallback path as first-class, since iPads are a likely device for this audience.

Round-trip integrity is a standing test target: profile export → import on a fresh browser → identical skill states and schedules; snapshot save → load → identical VM state hash.

### 8.4 Parent dashboard

A read-only view per profile, reachable from the profile picker behind a lightweight grown-up gate (a "type 7 × 8" interstitial — friction against bored children, explicitly not security, and labeled as such in code comments so nobody hardens it later). Everything is computed on demand from the profile's local state and telemetry; the dashboard collects nothing new and nothing leaves the device, preserving the §8.2 privacy stance.

**Shows (v1):** current unit and position in the skill graph (mastered / in-progress / locked counts, with child-facing skill names — "can follow an arrow to a box", never internal IDs); activity over the last 7 and 30 days (sessions, minutes, items answered); review health (due and overdue counts — a growing overdue pile is the early signal that practice has lapsed); a struggle list (skills currently in relearning, or with repeated recent failures); and milestones (unit completions, the BitBot-16 unlock). The profile export button (§8.2) lives here. One static line of cadence guidance ("a few short sessions a week keeps reviews healthy") is enough coaching; the dashboard should inform, not nag.

**Deliberately excluded:** comparisons between profiles (sibling leaderboards are incentive poison), time-on-site praise, streak pressure, and notifications of any kind. The dashboard reports the same mastery-based measures the XP system rewards (§5.5), so parents and the app never pull the child in different directions.

Ships in Phase 3, by which point there is enough content and telemetry for it to display something meaningful.

---

## 9. UX and age-band adaptations (8–9 vs 10–12)

The same graph serves both bands; the *interaction mode* adapts:

- **Input mode ladder:** tap-to-place instruction tiles (no typing) → tile palette with typed operands → full text editor with structure-aware autocomplete. Mode is per-student, switchable, and the diagnostic seeds it. Parsons-heavy item mix for the youngest band.
- **Reading load:** no audio narration (decision log, §11). All lesson text is written at early-reader level — short sentences, controlled vocabulary, one idea per screen — with the animation carrying as much meaning as the words. Honest consequence: this sets a reading floor for the 8–9 band; a child who can't yet read simple sentences independently will need a grown-up nearby for lessons (practice items are much less text-dependent). Browser text-to-speech is a cheap retrofit if piloting shows the floor is too high.
- **Session shaping:** 8–9s get shorter sessions (10–15 min), more screen-target items, slower automaticity thresholds.
- **No time pressure UI** except on designated speed drills, and even there latency thresholds are generous and invisible until passed (timers visibly counting down raise anxiety without benefit for this purpose — low confidence, but cheap to do).
- Everything keyboard-optional through Unit 6.

Honest caveat repeated: the 8–9 band is unproven territory for this material. The mitigation is instrumentation plus a graph that doesn't care how slowly you traverse it.

---

## 10. Misconception kill-list (design checklist)

Wired into specific units (§4) but kept here as a checklist for item authoring — every one of these should have dedicated discrimination items in the review pool:

address vs. value; `M[a]` vs `M[M[a]]`; assignment direction; assignment-as-copy (old value destroyed, source unchanged); the machine executes steps not intentions; one variable holds one value; loop boundary conditions; `=` vs `==` (Unit 10); array index from 0 as a *consequence* of base+offset, not a convention to memorize; parameters are copies (hence pointers); a pointer is a number, not a tether; strings end at 0, not at the edge of anything.

---

## 11. Decision log

All launch-design decisions are resolved; recorded here so the reasoning travels with the spec.

1. **Addressing mode** — memory-indirect (LOADP/STOREP), plus PLUSONE/MINUSONE in BitBot-8 for loop/pointer-walk ergonomics, plus SP-relative LOADS/STORES in BitBot-16 for stack frames. Rationale in §3.2, §3.3.
2. **BitBot-16 upgrade** — confirmed as core design; Phase 4 and Units 9+ assume it (§3.3).
3. **MiniC int size** — 16-bit `int`. The divergence from the 32-bit `int` of typical desktop C is accepted and taught explicitly in Unit 15's "travel guide."
4. **Audio narration** — cut. Reading load for the 8–9 band is handled through text and interaction design instead (§9); browser text-to-speech remains a cheap retrofit if pilot data demands it.
5. **Parent dashboard** — in scope: read-only, local-only, Phase 3 (§8.4). Cloud sync remains out of scope.
6. **Two's complement placement** — stays in Unit 5 as a mini-lesson; revisit only if Unit 5 pilot data shows overload.
7. **Playground unlock policy** — progressive unlock, with a parent-facing "unlock everything" toggle (§8.1).

---

## 12. References for verification

- Sweller & Cooper (1985), *Cognition and Instruction* — worked-example effect.
- Kirschner, Sweller & Clark (2006), *Educational Psychologist* 41(2) — minimal guidance critique; rebuttal: Hmelo-Silver, Duncan & Chinn (2007), same journal.
- Roediger & Karpicke (2006), *Psychological Science* — testing effect; Adesope et al. (2017), *Review of Educational Research* — meta-analysis.
- Cepeda, Pashler, Vul, Wixted & Rohrer (2006), *Psychological Bulletin* — spacing meta-analysis.
- Rohrer & Taylor (2007); Rohrer, Dedrick & Stershic (2015), *J. Educational Psychology* — interleaving.
- Kalyuga, Ayres, Chandler & Sweller (2003), *Educational Psychologist* — expertise reversal.
- Bloom (1968) *Learning for Mastery*; Bloom (1984) "The 2 Sigma Problem," *Educational Researcher* — read alongside modern tutoring meta-analyses (e.g., Nickow, Oreopoulos & Quan, 2020, NBER w27476) for calibrated effect sizes.
- Parsons & Haden (2006); Ericson, Margulieux & Rick (2017, Koli Calling); Ericson et al. (2022) — Parsons problems.
- du Boulay (1986), *J. Educational Computing Research* — notional machines; Pea (1986) — the "superbug"; Sorva (2013), *ACM TOCE* — survey of notional machines & program visualization.
- Pashler, McDaniel, Rohrer & Bjork (2008), *Psychological Science in the Public Interest* — learning styles lack evidence.
- FSRS: github.com/open-spaced-repetition (algorithm + published benchmarks vs. SM-2 on Anki review logs).
- The Math Academy Way (Skycak) — mastery graphs, layered review, generated problems; the engineering above is my reconstruction of those mechanisms, not a copy.

Citation caution: these are from memory and the venues/years should be spot-checked before you cite them anywhere formal; I'm confident in authors and findings, less so in exact years for one or two (notably du Boulay and the Ericson papers).
