# Screenshots

## App action shots

Real captures of the running app, used in the top-level [`README.md`](../../README.md).
They're taken with Playwright against `npm run dev` (see "Generating the README screenshots"
in [`../DEVELOPMENT.md`](../DEVELOPMENT.md)):

- [`home.png`](./home.png) — the home screen: the map of Units 0–15.
- [`lesson-bits.png`](./lesson-bits.png) — a binary lesson with the place-value scaffold.
- [`playground-bitbot8.png`](./playground-bitbot8.png) — BitBot-8: a painted pixel picture
  and the matching memory boxes ("the screen is memory").
- [`playground-assembly.png`](./playground-assembly.png) — the assembly editor with
  assembled bytes and the instruction reference.
- [`playground-minic.png`](./playground-minic.png) — the MiniC compiler view: C and the
  generated BitBot-16 assembly, side by side.
- [`playground-snake.png`](./playground-snake.png) — Snake running on the memory-mapped
  screen.
- [`playground-realc.png`](./playground-realc.png) — the sandboxed real-C interpreter with
  `printf`/`pixel`.
- [`dashboard.png`](./dashboard.png) — the local-only parent dashboard.

## Binary scaffolding animations

Animated SVGs that illustrate the binary place-value scaffolding UI as a sequence of states,
used when reviewing the scaffold-fade behavior:

- [`binary-lesson-scaffold.svg`](./binary-lesson-scaffold.svg) — the lesson bit exercise
  turning on the 4 and 1 places to make 5.
- [`binary-knowledge-check-scaffold.svg`](./binary-knowledge-check-scaffold.svg) — the same
  place-value scaffold in the knowledge check while reading `0101` and making `10` with
  switches.
- [`binary-scaffold-fade-policy.svg`](./binary-scaffold-fade-policy.svg) — the scaffold
  lifecycle: full support, faded support, hidden support, then restored support after an
  error.
- [`debug-scaffold-controls.svg`](./debug-scaffold-controls.svg) — the debug-only manual
  override controls.
