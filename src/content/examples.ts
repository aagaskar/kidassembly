import { Op, SCREEN_START } from "../vm/types";

/** Examples shelf for the playground (§8.1). */
export interface Example {
  name: string;
  description: string;
  program?: number[];
  /** Extra memory pokes (e.g. ready-made pixel art). */
  memory?: Record<number, number>;
}

function smileyPixels(): Record<number, number> {
  const YELLOW = 10;
  const BLACK = 0;
  const face = [
    ".XXXXXX.",
    "XXXXXXXX",
    "XX.XX.XX",
    "XXXXXXXX",
    "X.XXXX.X",
    "XX....XX",
    "XXXXXXXX",
    ".XXXXXX.",
  ];
  const out: Record<number, number> = {};
  face.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      out[SCREEN_START + y * 8 + x] = ch === "X" ? YELLOW : BLACK;
    });
  });
  return out;
}

export const EXAMPLES: Example[] = [
  {
    name: "Light one pixel",
    description: "Three instructions: put a color in A, store it into a screen box, stop.",
    program: [Op.LOADC, 8, Op.STORE, 130, Op.HALT, 0],
  },
  {
    name: "Two pixels, two colors",
    description: "Same trick twice. Try changing the colors and boxes!",
    program: [Op.LOADC, 12, Op.STORE, 128, Op.LOADC, 14, Op.STORE, 191, Op.HALT, 0],
  },
  {
    name: "Mystery machine: paint a row",
    description:
      "This one uses instructions you haven't met yet (a loop with a moving arrow). Run it slowly and watch — you'll learn how it works in Units 5 and 6.",
    // loop: LOADC 3 / STOREP ptr / PLUSONE ptr / SUB last / JNEG loop / HALT
    //       ptr: .byte 128   last: .byte 136
    program: [
      Op.LOADC, 3,    // 0: color
      Op.STOREP, 12,  // 2: paint where ptr (box 12) points
      Op.PLUSONE, 12, // 4: move ptr right; new ptr lands in A
      Op.SUB, 13,     // 6: A = ptr − last
      Op.JNEG, 0,     // 8: still before the end — go again
      Op.HALT, 0,     // 10
      128,            // 12: ptr — first pixel of the top row
      136,            // 13: last — one past the end of the row
    ],
  },
  {
    name: "Smiley (pixel art)",
    description: "No program at all — just bytes in the screen boxes. Paint over it!",
    memory: smileyPixels(),
  },
];
