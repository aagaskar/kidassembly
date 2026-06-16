import { Lesson } from "../engine/types";
import { Op } from "../vm/types";

/**
 * Phase-3 content: Units 3–8 (§4 of the design doc).
 * Unit 3 still works in raw machine code (earning the assembler);
 * Unit 4 introduces the assembler; Units 5–7 are assembly;
 * Unit 8 is the bridge to C (match + compiler view, no C writing).
 */

const B = (hint?: string) => ({ blank: true as const, hint });

export const LESSONS_3_TO_8: Lesson[] = [
  // ---------------------------------------------------------------- Unit 3
  {
    id: "u03.add",
    unit: 3,
    title: "BitBot learns to add",
    summary: "ADD puts box-values together. SUB takes them away.",
    steps: [
      {
        kind: "info",
        text: "Two new instructions! ADD (number 4): add what's in a box to A. SUB (number 5): subtract what's in a box from A. Watch this program: it loads 30, then adds what's in box 10.",
        sim: { program: [Op.LOADC, 30, Op.ADD, 10, Op.HALT, 0], memory: { 10: 12 } },
        highlight: [10],
      },
      {
        kind: "predict",
        text: "Box 10 holds 12. The program does LOADC 30, then ADD 10. Predict A after both steps.",
        sim: { program: [Op.LOADC, 30, Op.ADD, 10, Op.HALT, 0], memory: { 10: 12 } },
        stepsToRun: 2,
        ask: { what: "A" },
        explain: "ADD 10 means \"add what's IN box 10\" — not the number 10. Address vs. value, always.",
      },
      {
        kind: "predict",
        text: "Now SUB. Box 11 holds 5. A becomes 20, then we SUB 11. What is A at the end?",
        sim: { program: [Op.LOADC, 20, Op.SUB, 11, Op.HALT, 0], memory: { 11: 5 } },
        stepsToRun: 2,
        ask: { what: "A" },
      },
      {
        kind: "fillblank",
        text: "Make BitBot compute 25 + 17. Box 20 already holds 17. Fill in the two blanks, then run it. (LOADC is 1, ADD is 4.)",
        program: [Op.LOADC, B("number"), Op.ADD, B("box"), Op.STORE, 30, Op.HALT, 0],
        check: {
          cases: [{ memory: { 20: 17 }, cells: { 30: 42 } }],
        },
        explain: "You just wrote arithmetic in raw machine code. 1 25 4 20 — the machine only ever sees numbers.",
      },
      {
        kind: "quiz",
        text: "A holds 7. The machine runs ADD 7. Box 7 holds 3. What is A now?",
        choices: ["14", "10", "3", "7"],
        answer: 1,
        explain: "ADD 7 fetches what's IN box 7 (which is 3). 7 + 3 = 10. The operand is an ADDRESS.",
      },
    ],
  },
  {
    id: "u03.machine_code",
    unit: 3,
    title: "Raw machine code",
    summary: "Write whole programs as nothing but numbers.",
    steps: [
      {
        kind: "info",
        text: "Time to write programs the hard way — as raw numbers. Every instruction is 2 boxes: the instruction number, then its helper number. LOADC=1, LOAD=2, STORE=3, ADD=4, SUB=5, HALT=0. (Writing numbers gets old fast. That's the point. A better way is coming.)",
      },
      {
        kind: "fillblank",
        text: "This program should copy box 40 into box 41. Fill in the instruction NUMBERS. (LOAD a box is 2; STORE into a box is 3.)",
        program: [B("op"), 40, B("op"), 41, Op.HALT, 0],
        check: {
          cases: [
            { memory: { 40: 9 }, cells: { 41: 9 } },
            { memory: { 40: 77 }, cells: { 41: 77 } },
          ],
        },
        explain: "It works for ANY number in box 40 — you wrote a copying machine, not an answer.",
      },
      {
        kind: "fillblank",
        text: "Double whatever is in box 50, into box 51. Load it, add it again, store it. Three blanks!",
        program: [Op.LOAD, B("box"), Op.ADD, B("box"), Op.STORE, B("box"), Op.HALT, 0],
        check: {
          cases: [
            { memory: { 50: 6 }, cells: { 51: 12 } },
            { memory: { 50: 21 }, cells: { 51: 42 } },
          ],
        },
      },
      {
        kind: "drill",
        text: "Instruction practice — what do these do?",
        drill: "opcode",
        count: 4,
      },
    ],
  },
  {
    id: "u03.first_pixel",
    unit: 3,
    title: "First pixels!",
    summary: "Boxes 128–191 ARE the screen. Store a number, light a pixel.",
    steps: [
      {
        kind: "info",
        text: "Big secret: boxes 128 to 191 are special. They ARE the screen — 8 rows of 8 boxes. Put a number in box 128 and the top-left pixel changes color! 0 is black, 1–15 are colors. Watch: this program stores 4 into box 130.",
        sim: { program: [Op.LOADC, 4, Op.STORE, 130, Op.HALT, 0] },
        highlight: [130],
      },
      {
        kind: "predict",
        text: "After LOADC 4 and STORE 130 run, what number is in box 130?",
        sim: { program: [Op.LOADC, 4, Op.STORE, 130, Op.HALT, 0] },
        stepsToRun: 2,
        ask: { what: "cell", addr: 130 },
        explain: "Look at the screen — pixel 3 of the top row lit up! The screen is just memory you can see.",
      },
      {
        kind: "fillblank",
        text: "Light the FIRST pixel of the SECOND row with color 2. Rows are 8 boxes long, so the second row starts at box 136.",
        program: [Op.LOADC, B("color"), Op.STORE, B("box"), Op.HALT, 0],
        check: {
          cases: [{ cells: { 136: 2 } }],
        },
      },
      {
        kind: "fillblank",
        text: "Two pixels, one program: put color 7 in box 128 AND box 135 (both ends of the top row).",
        program: [Op.LOADC, 7, Op.STORE, B("box"), Op.STORE, B("box"), Op.HALT, 0],
        check: {
          cases: [{ cells: { 128: 7, 135: 7 } }],
        },
        explain: "One LOADC, two STOREs — A keeps its value until you change it.",
      },
    ],
  },
  {
    id: "u03.wraparound",
    unit: 3,
    title: "The overflow problem",
    summary: "A byte can't hold more than 255 — add past it and the extra digit overflows to 0.",
    steps: [
      {
        kind: "info",
        text: "A box holds 0 to 255 and NOTHING else. So what happens at 255 + 1? The real answer, 256, needs a 9th digit — but the box only has 8 switches. That extra digit doesn't fit, so it falls off and we're left with 0. Losing the digit that won't fit is called overflow. It isn't a bug — it's what 8 switches must do.",
      },
      {
        kind: "predict",
        text: "A becomes 250, then we ADD box 12, which holds 10. There is no 260! Predict A.",
        sim: { program: [Op.LOADC, 250, Op.ADD, 12, Op.HALT, 0], memory: { 12: 10 } },
        stepsToRun: 2,
        ask: { what: "A" },
        explain: "250 + 10 = 260, and 260 − 256 = 4. The byte wrapped past zero.",
      },
      {
        kind: "predict",
        text: "Wrap the other way: A is 3, SUB box 12 which holds 10. Predict A. (Count backwards past 0…)",
        sim: { program: [Op.LOADC, 3, Op.SUB, 12, Op.HALT, 0], memory: { 12: 10 } },
        stepsToRun: 2,
        ask: { what: "A" },
        explain: "3 − 10 wraps to 249. Remember this — it's the secret behind negative numbers, coming in Unit 5.",
      },
      {
        kind: "quiz",
        text: "What is 255 + 1 in a byte?",
        choices: ["256", "0", "255", "1"],
        answer: 1,
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 4
  {
    id: "u04.mnemonics",
    unit: 4,
    title: "The assembler: names for numbers",
    summary: "You invented a tool: it turns names like LOADC into the numbers.",
    steps: [
      {
        kind: "info",
        text: "Writing 1 25 4 20 is painful. So programmers invented a translator: you write NAMES (LOADC 25, ADD 20), it writes the numbers for you. The names are called mnemonics, the translator is an assembler. Nothing new is happening — it's the same numbers, spelled friendlier.",
      },
      {
        kind: "parsons",
        text: "Build this program from pieces: put 9 into A, store it in box 60, stop. (Read each piece out loud!)",
        lines: ["LOADC 9", "STORE 60", "HALT"],
        explain: "The assembler will turn that into 1 9 3 60 0 0 — the exact bytes you used to write by hand.",
      },
      {
        kind: "target",
        text: "Your first typed program! Write assembly that puts the number 5 into box 70. End with HALT.",
        starter: "; write your program here\n",
        check: {
          cases: [{ cells: { 70: 5 } }],
        },
        solution: "LOADC 5\nSTORE 70\nHALT",
        explain: "See the numbers next to your code? That's the assembler showing its work — names are just numbers.",
      },
      {
        kind: "target",
        text: "Copy box 80 into box 81 — whatever it holds. (LOAD gets a box's contents into A.)",
        check: {
          cases: [
            { memory: { 80: 33 }, cells: { 81: 33 } },
            { memory: { 80: 200 }, cells: { 81: 200 } },
          ],
        },
        solution: "LOAD 80\nSTORE 81\nHALT",
      },
    ],
  },
  {
    id: "u04.labels",
    unit: 4,
    title: "Labels: names for boxes",
    summary: "A label names an address. Use names instead of box numbers.",
    steps: [
      {
        kind: "info",
        text: "The assembler can name BOXES too. Write \"score: .byte 0\" — the \".byte\" part is a DIRECTIVE, a command to the assembler to set aside a box (in regular coding you'd call that making a variable). From then on, \"score\" means that box's ADDRESS. Names for instructions, names for boxes — every programming language above this is more of the same.",
      },
      {
        kind: "cview",
        text: "Step through this. \"score\" is just box 8 wearing a name tag — watch the assembler's bytes use the number 8.",
        c: [],
        asm: "LOAD score\nADD bonus\nSTORE score\nHALT\nscore: .byte 10\nbonus: .byte 5",
        lineMap: {},
        memory: {},
      },
      {
        kind: "target",
        text: "Declare boxes apples (holding 20), bananas (holding 22) and total (holding 0) with labels, then add the fruit into total. The machine must END with the sum in A. (Hint: STORE doesn't change A.)",
        starter: "; your code here, then your labeled boxes\n",
        check: {
          cases: [{ A: 42, expectSymbols: { total: 42 } }],
          maxSteps: 1000,
        },
        solution: "LOAD apples\nADD bananas\nSTORE total\nHALT\napples:  .byte 20\nbananas: .byte 22\ntotal:   .byte 0",
        explain: "Labels move around when code changes, and the assembler keeps track — that's its whole job.",
      },
      {
        kind: "bughunt",
        text: "This program should add 3 to score (10 + 3 = 13), but the programmer grabbed the wrong label somewhere. Fix it!",
        asm: "LOAD three\nADD three\nSTORE score\nHALT\nscore: .byte 10\nthree: .byte 3",
        check: {
          cases: [{ cells: { 8: 13 } }],
        },
        solution: "LOAD score\nADD three\nSTORE score\nHALT\nscore: .byte 10\nthree: .byte 3",
        explain: "LOAD three / ADD three makes 6, not 13. Reading what the code SAYS (not what you meant) is the debugging superpower.",
      },
    ],
  },
  {
    id: "u04.variables",
    unit: 4,
    title: "Labels ARE variables",
    summary: "A variable is an address with a nickname. You've been using them.",
    steps: [
      {
        kind: "info",
        text: "Here's a secret about every programming language: a VARIABLE is just a box with a name. \"score: .byte 0\" IS a variable. There's no magic container — there's an address, a nickname, and whatever number is in the box. You already knew this!",
      },
      {
        kind: "drill",
        text: "Box-vs-contents check (this matters forever).",
        drill: "addrvalue",
        count: 4,
      },
      {
        kind: "target",
        text: "A program with three variables: load x, subtract y, store the answer in z. Declare all three as labels (give x the value 50 and y the value 8 in their .byte lines).",
        starter: "; code first, then your labeled boxes\n",
        check: {
          cases: [{ A: 42, expectSymbols: { z: 42 } }],
          maxSteps: 1000,
        },
        solution: "LOAD x\nSUB y\nSTORE z\nHALT\nx: .byte 50\ny: .byte 8\nz: .byte 0",
        explain: "x, y, z — that's what they'll be called in C, too. Same boxes, same idea.",
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 5
  {
    id: "u05.jump",
    unit: 5,
    title: "Going in circles: JUMP",
    summary: "JUMP changes PC. The machine repeats whatever you point it back at.",
    steps: [
      {
        kind: "info",
        text: "JUMP (number 6) does one tiny thing: it sets PC. The machine doesn't know it's \"in a loop\" — it just keeps doing the next instruction, and you pointed \"next\" backwards. Watch this program count up forever: PLUSONE bumps box 20, JUMP 0 starts over.",
        sim: { program: [Op.PLUSONE, 20, Op.JUMP, 0] },
        highlight: [20],
      },
      {
        kind: "predict",
        text: "PLUSONE 20 then JUMP 0, over and over. After 6 steps (3 laps), what's in box 20?",
        sim: { program: [Op.PLUSONE, 20, Op.JUMP, 0] },
        stepsToRun: 6,
        ask: { what: "cell", addr: 20 },
        explain: "Each lap is 2 steps: PLUSONE, then JUMP. 3 laps = 3 plus-ones.",
      },
      {
        kind: "quiz",
        text: "This program never stops. Does BitBot mind?",
        choices: [
          "Yes — it knows something is wrong",
          "No — it just does the next step, forever",
        ],
        answer: 1,
        explain: "The machine has no intentions. It executes steps, not wishes. (Forever-loops are sometimes exactly what you want — games run one!)",
      },
    ],
  },
  {
    id: "u05.jz",
    unit: 5,
    title: "Decisions: JZ",
    summary: "JZ jumps only if A is exactly 0. That's how machines decide.",
    steps: [
      {
        kind: "info",
        text: "JZ (jump-if-zero, number 7) looks at A. If A is exactly 0, it jumps. Otherwise it does nothing and the machine continues. Every if, every loop-that-ends, every decision a computer ever makes — built from this.",
      },
      {
        kind: "predict",
        text: "A is loaded with 0, then JZ 8 runs. Where does PC end up? (Box 8 has a HALT.)",
        sim: { program: [Op.LOADC, 0, Op.JZ, 8, Op.LOADC, 99, Op.HALT, 0, Op.HALT, 0] },
        stepsToRun: 2,
        ask: { what: "PC" },
        explain: "A was 0, so JZ jumped to 8 — skipping the LOADC 99 entirely.",
      },
      {
        kind: "predict",
        text: "Same program, but A starts as 5. Now what is A at the end? (Does the JZ jump this time?)",
        sim: { program: [Op.LOADC, 5, Op.JZ, 8, Op.LOADC, 99, Op.HALT, 0, Op.HALT, 0] },
        stepsToRun: 3,
        ask: { what: "A" },
        explain: "A was 5, not 0 — JZ did nothing, so LOADC 99 ran.",
      },
    ],
  },
  {
    id: "u05.twos",
    unit: 5,
    title: "Negative numbers (the wraparound secret)",
    summary: "\"−1\" is the number that wraps to 0 when you add 1. That's 255!",
    steps: [
      {
        kind: "info",
        text: "Remember overflow? 255 + 1 wraps to 0. So in byte-land, 255 BEHAVES like −1: add it, and you go down by one. 254 behaves like −2. This trick is called two's complement, and it's how every real computer does negative numbers.",
      },
      {
        kind: "drill",
        text: "\"What do you add to get zero?\" — that's what a negative number IS.",
        drill: "twos",
        count: 4,
      },
      {
        kind: "info",
        text: "How does the machine TELL negatives apart? The top-left light. Numbers 128–255 (top bit ON) are treated as negative. JNEG (number 8) jumps when A's top bit is 1. So after SUB, JNEG means \"jump if the answer went below zero\".",
      },
      {
        kind: "predict",
        text: "A = 3, SUB box 12 (which holds 10) → A wraps to 249, top bit ON. JNEG 10 is next. Predict PC after the JNEG runs. (Box 10 has a HALT.)",
        sim: {
          program: [Op.LOADC, 3, Op.SUB, 12, Op.JNEG, 10, Op.HALT, 0, Op.HALT, 0, Op.HALT, 0],
          memory: { 12: 10 },
        },
        stepsToRun: 3,
        ask: { what: "PC" },
        explain: "3 − 10 \"went negative,\" the top bit switched on, and JNEG fired. The machine can now compare numbers!",
      },
    ],
  },
  {
    id: "u05.countdown",
    unit: 5,
    title: "The countdown loop",
    summary: "MINUSONE the counter, JZ when it hits zero — the loop idiom.",
    steps: [
      {
        kind: "info",
        text: "PLUSONE and MINUSONE bump a box up or down — and leave the new value in A. That makes the most famous loop in computing read like a sentence: MINUSONE count… JZ done… JUMP back. Count down to zero, then leave.",
        sim: {
          asm: "loop: MINUSONE count\nJZ done\nJUMP loop\ndone: HALT\ncount: .byte 3",
        },
      },
      {
        kind: "trace",
        text: "Trace this countdown! Box \"count\" starts at 3. Each row of the table is one visit to the top of the loop (box 0). Fill in count and A at each visit.",
        sim: {
          asm: "loop: MINUSONE count\nJZ done\nJUMP loop\ndone: HALT\ncount: .byte 3",
        },
        watchPC: 0,
        columns: [
          { watch: 8, label: "count (box 8)" },
          { watch: "A", label: "A" },
        ],
        maxRows: 3,
        explain: "MINUSONE leaves the fresh value in A, so JZ tests exactly the number you just made. No hidden state anywhere.",
      },
      {
        kind: "parsons",
        text: "Build a countdown that PLUSONEs box \"score\" exactly as many times as box \"count\" says, then stops. One piece doesn't belong!",
        lines: [
          "loop: PLUSONE score",
          "MINUSONE count",
          "JZ done",
          "JUMP loop",
          "done: HALT",
          "score: .byte 0",
          "count: .byte 5",
        ],
        distractors: ["JUMP done"],
        explain: "JUMP done would leave after one lap no matter what count says — the JZ is what watches the counter.",
      },
    ],
  },
  {
    id: "u05.loop_bugs",
    unit: 5,
    title: "Off-by-one safari",
    summary: "Loop boundaries are where bugs live. Hunt one now, cheaply.",
    steps: [
      {
        kind: "info",
        text: "The most common bug in all of programming: the loop that runs one time too many or too few. They're cheap to find on a 5-line program — so let's find some now, before your programs are 500 lines.",
      },
      {
        kind: "trace",
        text: "This loop SHOULD add box \"step\" to \"total\" 4 times. Trace it and watch carefully — how many times does it really add?",
        sim: {
          asm: "loop: LOAD total\nADD step\nSTORE total\nMINUSONE count\nJZ done\nJUMP loop\ndone: HALT\ntotal: .byte 0\nstep: .byte 10\ncount: .byte 4",
        },
        watchPC: 0,
        columns: [
          { watch: 14, label: "total (box 14)" },
          { watch: 16, label: "count (box 16)" },
        ],
        maxRows: 4,
      },
      {
        kind: "bughunt",
        text: "This program should PLUSONE box \"score\" exactly 3 times (count starts at 3). It does it one time too FEW. Find the off-by-one and fix it.",
        asm: "start: MINUSONE count\nJZ done\nPLUSONE score\nJUMP start\ndone: HALT\nscore: .byte 0\ncount: .byte 3",
        check: {
          cases: [{ cells: { 10: 3 } }],
        },
        solution: "start: PLUSONE score\nMINUSONE count\nJZ done\nJUMP start\ndone: HALT\nscore: .byte 0\ncount: .byte 3",
        explain: "Testing BEFORE doing the work skips the last lap. Do the work, THEN count down and test. Order is everything.",
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 6
  {
    id: "u06.arrows",
    unit: 6,
    title: "Arrows: a box that points",
    summary: "LOADP follows the arrow: the box holds an ADDRESS, go there.",
    steps: [
      {
        kind: "info",
        text: "Remember the treasure hunt from Unit 1 — \"box 5 holds 17, box 17 holds 3\"? There's an instruction for that. LOADP (number 9) reads a box, treats what it finds as an ADDRESS, and fetches from THERE. The box is an arrow pointing at another box.",
        sim: { program: [Op.LOADP, 30, Op.HALT, 0], memory: { 30: 60, 60: 42 } },
        highlight: [30, 60],
      },
      {
        kind: "predict",
        text: "Box 30 holds 60. Box 60 holds 42. LOADP 30 runs — follow the arrow! What lands in A?",
        sim: { program: [Op.LOADP, 30, Op.HALT, 0], memory: { 30: 60, 60: 42 } },
        stepsToRun: 1,
        ask: { what: "A" },
        explain: "Two hops: box 30 says \"go to 60\", box 60 says \"42\". LOAD 30 would have given 60 — one hop. Feel the difference.",
      },
      {
        kind: "drill",
        text: "One hop or two? Don't let LOAD and LOADP blur together.",
        drill: "mlevel",
        count: 5,
      },
    ],
  },
  {
    id: "u06.storep",
    unit: 6,
    title: "Storing through arrows",
    summary: "STOREP writes where the arrow points — the program picks the spot.",
    steps: [
      {
        kind: "info",
        text: "STOREP (number 10) is the other direction: read the arrow box, then write A where it points. Why is that exciting? Because now the TARGET can change while the program runs. One STORE always hits the same box; one STOREP can hit a different box every lap of a loop.",
      },
      {
        kind: "predict",
        text: "A is 9. Box 25 holds 140 (an address on the screen!). STOREP 25 runs. Which box changes — 25 or 140? Predict what's in box 140 after.",
        sim: { program: [Op.LOADC, 9, Op.STOREP, 25, Op.HALT, 0], memory: { 25: 140 } },
        stepsToRun: 2,
        ask: { what: "cell", addr: 140 },
        explain: "Box 25 didn't change — it's the arrow. Box 140 got the 9 (and a pixel lit up!).",
      },
      {
        kind: "target",
        text: "Box 60 holds some screen address — you don't know which! Write a program that paints color 6 wherever box 60 points. (It must work no matter where the arrow aims.)",
        starter: "; paint 6 where box 60 points\n",
        check: {
          cases: [
            { memory: { 60: 130 }, cells: { 130: 6 } },
            { memory: { 60: 150 }, cells: { 150: 6 } },
            { memory: { 60: 188 }, cells: { 188: 6 } },
          ],
          maxSteps: 1000,
        },
        solution: "LOADC 6\nSTOREP 60\nHALT",
        explain: "Three different targets, one program, zero edits. THAT is what arrows buy you.",
      },
    ],
  },
  {
    id: "u06.pointer_word",
    unit: 6,
    title: "The word \"pointer\"",
    summary: "A box holding an address has a famous name: a pointer.",
    steps: [
      {
        kind: "info",
        text: "You've been following arrows for two lessons. Time to learn their grown-up name: a box that holds an address is called a POINTER. That's it. That's the whole scary word. A pointer is a plain number in a plain box — the number just happens to be an address.",
      },
      {
        kind: "quiz",
        text: "Box 12 holds 130. Which sentence is TRUE?",
        choices: [
          "Box 12 is tied to box 130 forever",
          "Box 12 holds the number 130, which we're using as an address",
          "Box 12 secretly contains box 130's value",
        ],
        answer: 1,
        explain: "A pointer is a number, not a tether. Store 99 into box 12 and it points at box 99 now — nothing else moved.",
      },
      {
        kind: "drill",
        text: "Pointer reflexes: LOAD vs LOADP, one more round.",
        drill: "mlevel",
        count: 4,
      },
    ],
  },
  {
    id: "u06.walk",
    unit: 6,
    title: "Walking the screen",
    summary: "PLUSONE the pointer each lap — paint a whole row with one loop.",
    steps: [
      {
        kind: "info",
        text: "Now combine everything. Keep a pointer aimed at the screen, paint, PLUSONE the pointer, repeat. The pointer WALKS across the screen. This is the program from the top of the unit — step it slowly and watch ptr's number climb.",
        sim: {
          asm: "        LOADC 128\n        STORE ptr\nloop:   LOADC 3\n        STOREP ptr\n        PLUSONE ptr\n        SUB last\n        JNEG loop\n        HALT\nptr:    .byte 0\nlast:   .byte 136",
        },
      },
      {
        kind: "trace",
        text: "Trace the walk: each row of the table is one visit to the top of the loop (box 4). Where does ptr point on each visit?",
        sim: {
          asm: "        LOADC 128\n        STORE ptr\nloop:   LOADC 3\n        STOREP ptr\n        PLUSONE ptr\n        SUB last\n        JNEG loop\n        HALT\nptr:    .byte 0\nlast:   .byte 132",
        },
        watchPC: 4,
        columns: [{ watch: 16, label: "ptr (box 16)" }],
        maxRows: 4,
        explain: "128, 129, 130, 131 — the pointer slid one box per lap. The screen filled left to right.",
      },
      {
        kind: "target",
        text: "Paint the WHOLE top row (boxes 128–135) with color 5, using a pointer loop. No fair writing 8 STOREs!",
        starter: "; walk a pointer from 128 to 135\n",
        check: {
          cases: [
            {
              cells: { 128: 5, 129: 5, 130: 5, 131: 5, 132: 5, 133: 5, 134: 5, 135: 5, 136: 0 },
            },
          ],
          maxSteps: 5000,
        },
        solution:
          "LOADC 128\nSTORE ptr\nloop: LOADC 5\nSTOREP ptr\nPLUSONE ptr\nSUB last\nJNEG loop\nHALT\nptr: .byte 0\nlast: .byte 136",
        explain: "Box 136 had to stay 0 — your loop had to stop exactly at the row's edge. You handled a boundary!",
      },
    ],
  },
  {
    id: "u06.copy",
    unit: 6,
    title: "The copying machine",
    summary: "Two pointers, one loop: copy a block of memory anywhere.",
    steps: [
      {
        kind: "info",
        text: "The professional move: TWO pointers. One walks the source boxes, one walks the destination, and the loop carries values across. Step through this — it copies 4 boxes starting at \"src\" onto the screen.",
        sim: {
          asm: "loop: LOADP from\nSTOREP to\nPLUSONE from\nPLUSONE to\nMINUSONE count\nJZ done\nJUMP loop\ndone: HALT\nfrom: .byte 20\nto: .byte 128\ncount: .byte 4",
          memory: { 20: 1, 21: 2, 22: 3, 23: 4 },
        },
        highlight: [20, 21, 22, 23],
      },
      {
        kind: "bughunt",
        text: "This copier should copy 3 boxes from 30 onward into 50 onward. But it copies the SAME source box every time. One pointer isn't walking — fix it.",
        asm: "loop: LOADP from\nSTOREP to\nPLUSONE to\nMINUSONE count\nJZ done\nJUMP loop\ndone: HALT\nfrom: .byte 30\nto: .byte 50\ncount: .byte 3",
        check: {
          cases: [
            {
              memory: { 30: 7, 31: 8, 32: 9 },
              cells: { 50: 7, 51: 8, 52: 9 },
            },
          ],
          maxSteps: 1000,
        },
        solution:
          "loop: LOADP from\nSTOREP to\nPLUSONE from\nPLUSONE to\nMINUSONE count\nJZ done\nJUMP loop\ndone: HALT\nfrom: .byte 30\nto: .byte 50\ncount: .byte 3",
        explain: "Both pointers have to walk. Forgetting one is a classic — you'll meet this bug again in C, and you'll recognize it.",
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 7
  {
    id: "u07.call",
    unit: 7,
    title: "A jump that remembers",
    summary: "CALL jumps AND saves where you were. RET goes back.",
    steps: [
      {
        kind: "info",
        text: "Suppose you write a brilliant paint-a-row routine and want to use it from three places. JUMP gets you there… but how does the routine get BACK? It would need to know who called it. CALL (11) solves this: it saves the return address before jumping. RET (12) reads that note and jumps back.",
      },
      {
        kind: "predict",
        text: "Where does the machine keep the note? On the STACK — boxes at the top of memory, tracked by register SP. CALL 10 runs from address 0. The return address (2) gets written at box 255. Predict what's in box 255 after one step.",
        sim: { program: [Op.CALL, 10, Op.HALT, 0, 0, 0, 0, 0, 0, 0, Op.RET, 0] },
        stepsToRun: 1,
        ask: { what: "cell", addr: 255 },
        explain: "CALL wrote 2 (the address AFTER the call) at box 255 and moved SP down. The machine left itself a breadcrumb.",
      },
      {
        kind: "predict",
        text: "Now let it finish: the routine at box 10 is just RET. After CALL and RET both run, where is PC?",
        sim: { program: [Op.CALL, 10, Op.HALT, 0, 0, 0, 0, 0, 0, 0, Op.RET, 0] },
        stepsToRun: 2,
        ask: { what: "PC" },
        explain: "RET popped the breadcrumb (2) into PC. The machine is back home, one box after the CALL.",
      },
      {
        kind: "quiz",
        text: "Why is the stack a PILE (last in, first out) instead of a single box?",
        choices: [
          "Because one box is too small for an address",
          "So routines can call other routines — each return address waits under the newer ones",
          "It's just tradition",
        ],
        answer: 1,
        explain: "Calls nest. The newest breadcrumb is needed first. A pile does exactly that.",
      },
    ],
  },
  {
    id: "u07.pushpop",
    unit: 7,
    title: "PUSH and POP",
    summary: "Save A on the stack pile, get it back later.",
    steps: [
      {
        kind: "info",
        text: "The stack isn't only for return addresses. PUSH (13) puts A on the pile; POP (14) takes the top back into A. Routines use this to avoid trampling the caller's numbers.",
      },
      {
        kind: "predict",
        text: "LOADC 7, PUSH, LOADC 50, POP. Four steps. What's in A at the end?",
        sim: { program: [Op.LOADC, 7, Op.PUSH, 0, Op.LOADC, 50, Op.POP, 0, Op.HALT, 0] },
        stepsToRun: 4,
        ask: { what: "A" },
        explain: "The 7 waited safely on the pile while A held 50, then POP brought it home.",
      },
      {
        kind: "parsons",
        text: "Order these so the routine \"shout\" can use A freely WITHOUT losing the caller's number: save first, restore last.",
        lines: ["shout: PUSH", "LOADC 15", "STORE 128", "POP", "RET"],
        explain: "PUSH at the door, POP on the way out — the polite-routine handshake. (It painted a pixel in between!)",
      },
    ],
  },
  {
    id: "u07.routine",
    unit: 7,
    title: "Your first routine",
    summary: "Argument in A, result in A — write a routine and call it twice.",
    steps: [
      {
        kind: "info",
        text: "Our calling convention (a fancy word for \"the deal\"): the caller puts the argument in A, the routine leaves its answer in A. Simple. Here's add10, called twice in a row — step it and watch the stack breathe in and out.",
        sim: {
          asm: "LOADC 5\nCALL add10\nCALL add10\nSTORE 40\nHALT\nadd10: ADD ten\nRET\nten: .byte 10",
        },
      },
      {
        kind: "target",
        text: "Write a routine \"triple\" that multiplies A by 3 (hint: a labeled box to stash A, then ADD it twice). The main program loads box 100, calls triple, stores the answer in box 101. Make ALL the test setups pass.",
        starter:
          "LOAD 100\nCALL triple\nSTORE 101\nHALT\n\ntriple: ; your routine here\nRET\n",
        check: {
          cases: [
            { memory: { 100: 4 }, cells: { 101: 12 } },
            { memory: { 100: 10 }, cells: { 101: 30 } },
          ],
          maxSteps: 2000,
        },
        solution:
          "LOAD 100\nCALL triple\nSTORE 101\nHALT\n\ntriple: STORE tmp\nADD tmp\nADD tmp\nRET\n\ntmp: .byte 0",
        explain: "One routine, any input. Argument in A, answer in A — you'll see this deal again inside every C function.",
      },
    ],
  },
  {
    id: "u07.overflow",
    unit: 7,
    title: "Eat your own stack",
    summary: "What if a routine calls itself forever? Watch the crash — on purpose.",
    steps: [
      {
        kind: "info",
        text: "Danger time (the fun kind). This routine CALLs ITSELF. Every call pushes another breadcrumb, SP marches down, down, down… straight toward your program. Run it FAST and watch the stack eat everything. This is a stack overflow — maybe the most famous crash in computing.",
        sim: { asm: "again: CALL again" },
      },
      {
        kind: "quiz",
        text: "Why did the program eventually destroy itself?",
        choices: [
          "The machine got tired",
          "Each CALL wrote a return address; SP walked down into the program's own boxes and overwrote them",
          "CALL is broken",
        ],
        answer: 1,
        explain: "Programs and the stack share the same 256 boxes. Nothing stops the pile from growing into the code — you watched it happen. (Tamed self-calling is called RECURSION; it comes back, safely, in Unit 11.)",
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 8
  {
    id: "u08.shorthand",
    unit: 8,
    title: "People got tired of typing",
    summary: "C lines are shorthand for assembly you already write.",
    steps: [
      {
        kind: "info",
        text: "Sixty years ago, programmers wrote what you write: LOAD, ADD, STORE, thousands of times. They got tired. So they built translators that accept SHORTHAND: you write x = x + 1; and the translator writes LOAD x, ADD one, STORE x. The shorthand is called C. You already speak the long version.",
      },
      {
        kind: "match",
        text: "Match each C line to the assembly it's shorthand for. (Read the C out loud — it says what it does.)",
        pairs: [
          { left: "x = 5;", right: "LOADC 5 / STORE x" },
          { left: "x = y;", right: "LOAD y / STORE x" },
          { left: "x = x + 1;", right: "LOAD x / ADD one / STORE x" },
          { left: "x = x - y;", right: "LOAD x / SUB y / STORE x" },
        ],
        explain: "No magic arrived. Each C line is a few instructions wearing a trench coat.",
      },
      {
        kind: "quiz",
        text: "In C, x = y; copies y into x. After it runs, what happened to y?",
        choices: ["y is now empty", "y is unchanged — copying isn't moving", "y became x"],
        answer: 1,
        explain: "Look at the assembly: LOAD y / STORE x. Nothing ever wrote to y. Assignment copies; the source keeps its value.",
      },
    ],
  },
  {
    id: "u08.cview",
    unit: 8,
    title: "The compiler view",
    summary: "Watch x = x + 1; turn into your assembly — and step both at once.",
    steps: [
      {
        kind: "cview",
        text: "The left side is C. The right side is what the translator (a COMPILER) makes of it. Step the machine: both sides highlight together. The C never runs — the assembly is what runs; C is instructions for making instructions.",
        c: ["x = 3;", "x = x + 1;", "y = x;"],
        asm: "LOADC 3\nSTORE x\nLOAD x\nADD one\nSTORE x\nLOAD x\nSTORE y\nHALT\nx: .byte 0\ny: .byte 0\none: .byte 1",
        lineMap: { 0: 0, 1: 0, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2 },
      },
      {
        kind: "quiz",
        text: "x = x + 1; became THREE instructions. Why not one?",
        choices: [
          "The compiler is being wasteful",
          "The machine only adds in A — so: fetch x, add, put it back",
          "C is slower than assembly",
        ],
        answer: 1,
        explain: "The shorthand hides steps, but the steps still happen. You can always un-hide them — that's what the compiler view is for.",
      },
      {
        kind: "match",
        text: "One more round, with loops in your future: match these.",
        pairs: [
          { left: "z = x + y;", right: "LOAD x / ADD y / STORE z" },
          { left: "x = 0;", right: "LOADC 0 / STORE x" },
          { left: "x = x - 1;", right: "MINUSONE x" },
        ],
        explain: "MINUSONE x — sometimes the machine has a single instruction for a whole C line. Compilers love those.",
      },
    ],
  },
  {
    id: "u08.cview_loop",
    unit: 8,
    title: "Loops in shorthand",
    summary: "A while loop compiles to the jumps you already know.",
    steps: [
      {
        kind: "cview",
        text: "Here's a C while-loop and its translation. The condition becomes a test-and-jump at the top; the } becomes JUMP back. Step it round a few laps — you have written this exact shape by hand.",
        c: ["while (count != 0) {", "  total = total + 2;", "  count = count - 1;", "}"],
        asm: "loop: LOAD count\nJZ done\nLOAD total\nADD two\nSTORE total\nMINUSONE count\nJUMP loop\ndone: HALT\ncount: .byte 3\ntotal: .byte 0\ntwo: .byte 2",
        lineMap: { 0: 0, 1: 0, 2: 1, 3: 1, 4: 1, 5: 2, 6: 3 },
      },
      {
        kind: "quiz",
        text: "Where did the C loop's \"check the condition\" end up in assembly?",
        choices: [
          "At the top: LOAD count / JZ done",
          "At the bottom, after the work",
          "Nowhere — the compiler removed it",
        ],
        answer: 0,
        explain: "Condition at the top, jump out if done — the idiom from Unit 5. C didn't invent loops; it abbreviates yours.",
      },
      {
        kind: "info",
        text: "You're ready. Next unit, BitBot grows up (more boxes! bigger numbers! a 32×32 screen!) and you start WRITING the shorthand yourself. Everything you've built — boxes, addresses, pointers, loops, routines — comes with you.",
      },
    ],
  },
];
