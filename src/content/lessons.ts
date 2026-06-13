import { Lesson } from "../engine/types";
import { Op } from "../vm/types";
import { LESSONS_3_TO_8 } from "./lessons3to8";
import { LESSONS_9_TO_15 } from "./lessons9to15";

/**
 * Phase-1 content: Units 0–2 (§4 of the design doc), hand-authored.
 * Text is written at early-reader level: short sentences, one idea per step.
 */

const B = (hint?: string) => ({ blank: true as const, hint });

const LESSONS_0_TO_2: Lesson[] = [
  // ---------------------------------------------------------------- Unit 0
  {
    id: "u00.switches",
    unit: 0,
    title: "Switches and lights",
    summary: "A computer is made of switches. A switch is OFF (0) or ON (1).",
    steps: [
      {
        kind: "info",
        text: "Deep inside, a computer is made of tiny switches. A switch can be OFF or ON. We write OFF as 0 and ON as 1. That's it — that's all a computer has!",
      },
      {
        kind: "bits",
        text: "Here is one switch. Turn it ON to show 1.",
        bitCount: 1,
        target: 1,
      },
      {
        kind: "info",
        text: "One switch can show two things: 0 or 1. What if we use TWO switches? Then we can show four things: 00, 01, 10, 11. More switches = more numbers!",
      },
      {
        kind: "bits",
        text: "Two switches. The right one counts 1. The left one counts 2. Turn on switches to show 3. (Hint: 2 + 1.)",
        bitCount: 2,
        target: 3,
      },
      {
        kind: "bits",
        text: "Now show 2. Only one switch should be on!",
        bitCount: 2,
        target: 2,
      },
    ],
  },
  {
    id: "u00.counting",
    unit: 0,
    title: "Counting in binary",
    summary: "Each switch counts double the one before: 1, 2, 4, 8.",
    steps: [
      {
        kind: "info",
        text: "Binary is counting with OFF and ON switches. 0 means a switch is OFF, so it adds 0. 1 means a switch is ON, so it adds its place value. From right to left the places are 1, 2, 4, 8 — each place is DOUBLE the one before. So 0101 has the 4 switch ON and the 1 switch ON: 4 + 1 = 5.",
      },
      {
        kind: "bits",
        text: "Four switches have place values 8, 4, 2, 1. Show the number 5. Turn ON the places you need; leave the others OFF. (Which two switches add up to 5?)",
        bitCount: 4,
        target: 5,
      },
      {
        kind: "bits",
        text: "Show 10. Turn ON 8 and 2, and leave 4 and 1 OFF. That makes 1010.",
        bitCount: 4,
        target: 10,
      },
      {
        kind: "drill",
        text: "Reading practice! 1 means ON and 0 means OFF. Add up only the ON place values.",
        drill: "bin2dec",
        count: 5,
        maxValue: 15,
      },
      {
        kind: "drill",
        text: "Now the other way: make the number with switches. Use the place values to choose which switches are ON.",
        drill: "dec2bin",
        count: 5,
        maxValue: 15,
      },
    ],
  },
  {
    id: "u00.bytes",
    unit: 0,
    title: "Bytes: 8 lights",
    summary: "Eight switches together make a byte. A byte holds 0 to 255.",
    steps: [
      {
        kind: "info",
        text: "Computers group switches in EIGHTS. Eight switches together are called a BYTE. The switch values are 128, 64, 32, 16, 8, 4, 2, 1.",
      },
      {
        kind: "bits",
        text: "A whole byte! Turn ON every switch. What do they add up to? That's the biggest number a byte can hold.",
        bitCount: 8,
        target: 255,
      },
      {
        kind: "bits",
        text: "Show 130 in a byte. (128 + 2.)",
        bitCount: 8,
        target: 130,
      },
      {
        kind: "drill",
        text: "Biggest-number practice.",
        drill: "maxn",
        count: 4,
      },
      {
        kind: "info",
        text: "Remember this: a byte holds a number from 0 to 255. Nothing smaller, nothing bigger. This will matter A LOT later.",
      },
    ],
  },
  {
    id: "u00.three_faces",
    unit: 0,
    title: "One byte, three faces",
    summary: "The same byte can be a number, a letter, or a color.",
    steps: [
      {
        kind: "info",
        text: "Here is a secret: a byte is JUST eight switches. It doesn't know what it means. WE decide. The byte 01000001 is the number 65. But if we say \"read it as a letter\", 65 means 'A'. If we say \"read it as a color\", it picks a color.",
        sim: { memory: { 40: 65 } },
        highlight: [40],
      },
      {
        kind: "quiz",
        text: "Box 40 holds the byte 65. If we read it as a LETTER, it shows 'A'. Did the byte change when we read it as a letter?",
        sim: { memory: { 40: 65 } },
        highlight: [40],
        choices: [
          "No — same switches, we just read them differently",
          "Yes — the computer turned it into a letter",
        ],
        answer: 0,
        explain: "The switches never changed. Meaning is in the READER, not the byte. Computers store only bits; everything else is how we choose to read them.",
      },
      {
        kind: "quiz",
        text: "A picture, a song, and your name are stored in a computer. What are they made of inside?",
        choices: ["Bits — all of them", "Pictures are made of tiny pictures", "Letters are made of letters"],
        answer: 0,
        explain: "Everything is bits. A picture is bytes read as colors. A name is bytes read as letters.",
      },
      {
        kind: "info",
        text: "Try it yourself later in the Playground: the memory grid has a view switch — the SAME boxes shown as numbers, binary lights, letters, or colors.",
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 1
  {
    id: "u01.boxes",
    unit: 1,
    title: "Boxes with addresses",
    summary: "Memory is 256 boxes. Every box has an address and holds one byte.",
    steps: [
      {
        kind: "info",
        text: "This grid is the computer's MEMORY: 256 boxes. Every box has an ADDRESS (its house number, 0 to 255) and holds one byte (a number 0 to 255). The address never changes. What's inside can.",
        sim: { memory: { 12: 99, 5: 17 } },
        highlight: [12],
      },
      {
        kind: "quiz",
        text: "Look at box 12 (highlighted). What is IN box 12?",
        sim: { memory: { 12: 99, 5: 17 } },
        highlight: [12],
        choices: ["99", "12", "Nothing"],
        answer: 0,
        explain: "Box 12 HOLDS 99. The 12 is its address — its house number — not what's inside.",
      },
      {
        kind: "quiz",
        text: "Same grid. What is the ADDRESS of the box holding 99?",
        sim: { memory: { 12: 99, 5: 17 } },
        highlight: [12],
        choices: ["12", "99", "Both"],
        answer: 0,
        explain: "The address is 12; the contents are 99. Keep these apart — it's the most important habit in this whole course.",
      },
      {
        kind: "predict",
        text: "Box 7 is highlighted. Type what is IN box 7.",
        sim: { memory: { 7: 31, 31: 7 } },
        stepsToRun: 0,
        ask: { what: "cell", addr: 7 },
        explain: "Box 7 holds 31. (And box 31 holds 7 — sneaky! Address and contents are different things.)",
      },
      {
        kind: "quiz",
        text: "A box's ADDRESS can change. True or false?",
        choices: ["False — addresses are fixed forever", "True — addresses change when the contents change"],
        answer: 0,
        explain: "Addresses are like house numbers: fixed. Only the CONTENTS change.",
      },
    ],
  },
  {
    id: "u01.treasure",
    unit: 1,
    title: "Treasure hunt",
    summary: "A box can hold the ADDRESS of another box. Follow the trail!",
    steps: [
      {
        kind: "info",
        text: "Game time. A box can hold the address of ANOTHER box — like a note saying \"the treasure is at house 17\". Follow the trail: look in a box, go to the address you find there.",
        sim: { memory: { 5: 17, 17: 3 } },
        highlight: [5, 17],
      },
      {
        kind: "predict",
        text: "Box 5 holds 17. Go to box 17. Type what you find there.",
        sim: { memory: { 5: 17, 17: 3 } },
        stepsToRun: 0,
        ask: { what: "cell", addr: 17 },
        explain: "Box 5 pointed you to box 17, and box 17 holds 3. You just followed an arrow through memory!",
      },
      {
        kind: "predict",
        text: "Longer trail! Box 10 holds 20. Box 20 holds 30. Box 30 holds 8. Start at box 10 and follow the trail TWICE. Type the number in the box you land on.",
        sim: { memory: { 10: 20, 20: 30, 30: 8 } },
        stepsToRun: 0,
        ask: { what: "cell", addr: 30 },
        explain: "Box 10 → box 20 → box 30, which holds 8. Following addresses like this has a grown-up name you'll meet much later: pointer chasing.",
      },
      {
        kind: "quiz",
        text: "Box 50 holds 60. Is 60 a number or an address?",
        choices: [
          "It's just a byte — it's an address only if we USE it as one",
          "It's always an address",
          "It's always a number",
        ],
        answer: 0,
        explain: "A byte is a byte. 60 becomes an address the moment we follow it. Meaning is in how we use it — just like the letter/color lesson.",
      },
    ],
  },

  // ---------------------------------------------------------------- Unit 2
  {
    id: "u02.wakes",
    unit: 2,
    title: "The machine wakes up",
    summary: "BitBot runs instructions one tiny step at a time: fetch, decode, execute.",
    steps: [
      {
        kind: "info",
        text: "Meet BitBot. It has one special box called A (its hand), and a pointer called PC that says which memory box holds the NEXT instruction. An instruction is two bytes: WHAT to do, and a number to do it with.",
        sim: { program: [Op.LOADC, 9, Op.HALT, 0] },
        highlight: [0, 1],
      },
      {
        kind: "info",
        text: "Instruction 1 is LOADC: \"put this number into A\". Instruction 0 is HALT: \"stop\". The boxes at 0 and 1 hold [1, 9] — that means LOADC 9. BitBot reads it, puts 9 into A, and moves PC forward by 2.",
        sim: { program: [Op.LOADC, 9, Op.HALT, 0] },
        highlight: [0, 1],
      },
      {
        kind: "predict",
        text: "Press nothing yet! PREDICT first: after BitBot runs ONE step of this program, what number is in A?",
        sim: { program: [Op.LOADC, 9, Op.HALT, 0] },
        stepsToRun: 1,
        ask: { what: "A" },
        explain: "LOADC 9 put 9 into A. BitBot did exactly one dumb little step — nothing more.",
      },
      {
        kind: "predict",
        text: "Same program, one step. Where does PC point now? (It started at 0, and an instruction is 2 boxes.)",
        sim: { program: [Op.LOADC, 9, Op.HALT, 0] },
        stepsToRun: 1,
        ask: { what: "PC" },
        explain: "PC moved from 0 to 2, where the next instruction (HALT) lives.",
      },
      {
        kind: "quiz",
        text: "Does BitBot understand what you WANT the program to do?",
        choices: [
          "No — it only does one tiny step at a time, exactly as written",
          "Yes — it reads your mind a little",
        ],
        answer: 0,
        explain: "BitBot has no idea what you want. It fetches one instruction, does it, and moves on. Every computer is like this.",
      },
    ],
  },
  {
    id: "u02.load",
    unit: 2,
    title: "LOAD: reading a box",
    summary: "LOAD copies a box's contents into A. LOADC uses the number itself.",
    steps: [
      {
        kind: "info",
        text: "New instruction! LOAD (number 2) means: \"go to the box at this address, COPY what's inside into A\". Careful — LOADC 7 puts 7 in A, but LOAD 7 puts whatever is IN BOX 7 into A. Address... or value. Sound familiar?",
        sim: { program: [Op.LOAD, 7, Op.HALT, 0], memory: { 7: 42 } },
        highlight: [7],
      },
      {
        kind: "predict",
        text: "Box 7 holds 42. The program runs LOAD 7, one step. What lands in A?",
        sim: { program: [Op.LOAD, 7, Op.HALT, 0], memory: { 7: 42 } },
        stepsToRun: 1,
        ask: { what: "A" },
        explain: "LOAD 7 went to box 7 and copied out the 42.",
      },
      {
        kind: "predict",
        text: "Now the tricky twin: this program runs LOADC 7 (load the CONSTANT 7), one step. Box 7 still holds 42. What lands in A?",
        sim: { program: [Op.LOADC, 7, Op.HALT, 0], memory: { 7: 42 } },
        stepsToRun: 1,
        ask: { what: "A" },
        explain: "LOADC ignores the boxes — the 7 itself goes into A. LOAD 7 fetches 42; LOADC 7 fetches 7. This difference matters forever.",
      },
      {
        kind: "predict",
        text: "Box 30 holds 5 and box 5 holds 88. The program runs LOAD 30, one step. What is in A?",
        sim: { program: [Op.LOAD, 30, Op.HALT, 0], memory: { 30: 5, 5: 88 } },
        stepsToRun: 1,
        ask: { what: "A" },
        explain: "LOAD 30 copies box 30's contents: 5. It does NOT follow the trail to box 5 — no instruction does that... yet.",
      },
      {
        kind: "quiz",
        text: "After LOAD copies a box into A, what happens to the box?",
        choices: ["Nothing — it still holds its value", "It becomes empty", "It holds A's old value"],
        answer: 0,
        explain: "LOAD is a COPY, not a move. The box keeps its value.",
      },
    ],
  },
  {
    id: "u02.store",
    unit: 2,
    title: "STORE: writing a box",
    summary: "STORE copies A into a box. The old value is gone forever.",
    steps: [
      {
        kind: "info",
        text: "STORE (number 3) is LOAD's opposite: \"copy A INTO the box at this address\". Whatever the box held before is wiped out. A keeps its value — STORE is a copy too.",
        sim: { program: [Op.LOADC, 55, Op.STORE, 20, Op.HALT, 0], memory: { 20: 11 } },
        highlight: [20],
      },
      {
        kind: "predict",
        text: "Box 20 holds 11. The program does LOADC 55, then STORE 20 (two steps). What is in box 20 after?",
        sim: { program: [Op.LOADC, 55, Op.STORE, 20, Op.HALT, 0], memory: { 20: 11 } },
        stepsToRun: 2,
        ask: { what: "cell", addr: 20 },
        explain: "STORE 20 wrote A's 55 into box 20. The 11 is gone — one box holds ONE value.",
      },
      {
        kind: "predict",
        text: "Same two steps. What is in A after the STORE?",
        sim: { program: [Op.LOADC, 55, Op.STORE, 20, Op.HALT, 0], memory: { 20: 11 } },
        stepsToRun: 2,
        ask: { what: "A" },
        explain: "Still 55! STORE copies A out; it doesn't empty A.",
      },
      {
        kind: "fillblank",
        text: "Your first program-writing! Fill the blanks so the program puts 99 into box 30, then halts. (LOADC is 1, STORE is 3 — the mnemonics are shown to help.)",
        program: [Op.LOADC, B("number?"), Op.STORE, B("box?"), Op.HALT, 0],
        check: { cases: [{ cells: { 30: 99 } }], maxSteps: 10 },
        explain: "LOADC 99 puts 99 in BitBot's hand; STORE 30 drops it into box 30.",
      },
      {
        kind: "fillblank",
        text: "Box 20 starts with some number. Fill the blanks to COPY box 20 into box 21. (This must work no matter what box 20 holds!)",
        program: [Op.LOAD, B("box?"), Op.STORE, B("box?"), Op.HALT, 0],
        check: {
          cases: [
            { memory: { 20: 77 }, cells: { 21: 77 } },
            { memory: { 20: 5 }, cells: { 21: 5 } },
          ],
          maxSteps: 10,
        },
        explain: "LOAD 20 picks up the value, STORE 21 puts it down. Copying a box always takes two steps: in to A, out of A.",
      },
    ],
  },
  {
    id: "u02.program_in_boxes",
    unit: 2,
    title: "Programs live in boxes too",
    summary: "The program itself sits in memory — instructions are just bytes.",
    steps: [
      {
        kind: "info",
        text: "Look closely at the grid: where IS the program? In the boxes! Boxes 0–5 hold the bytes [1, 9, 3, 20, 0, 0] — that's LOADC 9, STORE 20, HALT. Instructions are just bytes, living in the same memory as everything else.",
        sim: { program: [Op.LOADC, 9, Op.STORE, 20, Op.HALT, 0] },
        highlight: [0, 1, 2, 3, 4, 5],
      },
      {
        kind: "quiz",
        text: "Box 0 holds the byte 1. What is that 1?",
        sim: { program: [Op.LOADC, 9, Op.STORE, 20, Op.HALT, 0] },
        highlight: [0],
        choices: [
          "Just a byte — BitBot READS it as the instruction LOADC",
          "A special instruction-thing, different from a number",
        ],
        answer: 0,
        explain: "Same lesson as letters and colors: it's a byte. When PC points at it, BitBot reads it as an instruction. Meaning is in the reading.",
      },
      {
        kind: "info",
        text: "Now for something WILD. If programs live in boxes, a program can STORE into its own boxes... and rewrite itself while it runs. Watch box 5 — it's the number that the THIRD instruction will load!",
        sim: { program: [Op.LOADC, 7, Op.STORE, 5, Op.LOADC, 0, Op.HALT, 0] },
        highlight: [5],
      },
      {
        kind: "predict",
        text: "The program: LOADC 7 / STORE 5 / LOADC ? / HALT. Box 5 is the \"?\" — and STORE 5 just wrote into it! Run 3 steps in your head. What ends up in A?",
        sim: { program: [Op.LOADC, 7, Op.STORE, 5, Op.LOADC, 0, Op.HALT, 0] },
        stepsToRun: 3,
        ask: { what: "A" },
        explain: "STORE 5 changed the third instruction from LOADC 0 to LOADC 7 before it ran. The program rewrote itself! Programs are data. (Fun to know, dangerous to do — we won't make a habit of it.)",
      },
      {
        kind: "info",
        text: "You finished Unit 2! You can now read every step BitBot takes. Next up: teaching it to add, subtract... and light up its screen. See you in Unit 3!",
      },
    ],
  },
];

export const LESSONS: Lesson[] = [...LESSONS_0_TO_2, ...LESSONS_3_TO_8, ...LESSONS_9_TO_15];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
