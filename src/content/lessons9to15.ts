import { Lesson } from "../engine/types";

/**
 * Phase-4/5 content: Units 9–15 (§4). BitBot-16 arrives in Unit 9;
 * everything here runs through the MiniC compiler with synced stepping.
 * BitBot-16 memory map: screen 2048–3071 (32×32), KEY 3072, RANDOM 3073,
 * TICK 3074.
 */

export const LESSONS_9_TO_15: Lesson[] = [
  // ---------------------------------------------------------------- Unit 9
  {
    id: "u09.bitbot16",
    unit: 9,
    title: "BitBot grows up",
    summary: "4,096 boxes, numbers to 65,535, a 32×32 screen. Same machine, bigger.",
    steps: [
      {
        kind: "info",
        text: "You've unlocked BitBot-16! It has 4,096 boxes (16 pages of the grid), A holds numbers up to 65,535, and the screen is 32×32 — boxes 2048 to 3071. Instructions are the SAME ones you know, plus a few new tools. Everything you learned still works.",
        sim: { machine: "bb16", asm: "LOADC 9\nSTOREB 2048\nSTOREB 2080\nHALT" },
      },
      {
        kind: "info",
        text: "One real change: numbers bigger than 255 need TWO boxes. A pair of boxes read together is called a WORD. LOAD and STORE now move whole words; new instructions LOADB and STOREB move single bytes when that's what you want. Two sizes — remember that, it's about to matter.",
      },
      {
        kind: "predict",
        text: "On BitBot-16: LOADC 1000, STORE 200. A word is two boxes — predict what lands in box 200 (the LOW part: 1000 = 3×256 + 232).",
        sim: { machine: "bb16", asm: "LOADC 1000\nSTORE 200\nHALT" },
        stepsToRun: 2,
        ask: { what: "cell", addr: 200 },
        explain: "1000 split across boxes 200 (232) and 201 (3): 3 × 256 + 232 = 1000. Big numbers are byte teamwork.",
      },
      {
        kind: "quiz",
        text: "Why couldn't BitBot-8 hold 1000 in a box?",
        choices: [
          "It wasn't allowed to",
          "8 switches max out at 255 — 1000 needs more switches",
          "1000 is an unlucky number",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "u09.variables",
    unit: 9,
    title: "C variables: reserve a box, nickname it",
    summary: "int x; tells the compiler to set aside a word and remember its address.",
    steps: [
      {
        kind: "minic",
        text: "Your first real C program, in the compiler view. \"int x;\" reserves a word-sized spot and nicknames it x — find x's label in the assembly! Step it through: the C side and assembly side move together.",
        source: "int x;\n\nint main() {\n  x = 41;\n  x = x + 1;\n  return x;\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Your turn to WRITE C. Make the variable \"answer\" end up holding 42 — but compute it as 6 times 7, don't just type 42. (Statements end with ; — the error messages will help you.)",
        source: "int answer;\n\nint main() {\n  // your code here\n  return 0;\n}",
        mode: "edit",
        check: { cases: [{ A: 42 }] },
        solution: "int answer;\n\nint main() {\n  answer = 6 * 7;\n  return answer;\n}",
        explain: "Wait — where did the multiply come from? BitBot has no multiply instruction! Look at the assembly: CALL __mul. The compiler WROTE A LOOP for you (repeated adding). Shorthand, all the way down.",
      },
      {
        kind: "quiz",
        text: "In the compiler view, \"int x;\" produced no instructions — only a labeled box at the bottom. Why?",
        choices: [
          "The compiler ignored it",
          "Declaring reserves space; it doesn't DO anything at run time",
          "It's a bug",
        ],
        answer: 1,
        explain: "A declaration is a note to the compiler: \"set aside a box, remember the nickname.\" You did the same with score: .byte 0.",
      },
    ],
  },
  {
    id: "u09.types",
    unit: 9,
    title: "Types are sizes",
    summary: "char = 1 box, int = 2 boxes. The same bytes, different glasses.",
    steps: [
      {
        kind: "minic",
        text: "Two variables, two SIZES. Find them in the assembly's data section: c gets .byte (one box), x gets .word (two). Step through and watch the memory grid — STOREB for the char, STORE for the int.",
        source: "char c;\nint x;\n\nint main() {\n  c = 65;\n  x = 1000;\n  return 0;\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Remember Unit 0 — the same byte as number, letter, color? Here it is in C. A char holds one BYTE; stuff 300 into it and only the low byte (300 − 256 = 44) survives. Predict, then run: what does main return?",
        source: "char c;\n\nint main() {\n  c = 300;\n  return c;\n}",
        mode: "view",
        explain: "Types don't change the bytes — they say how many boxes to use and how to read them. 300 doesn't fit in one box.",
      },
      {
        kind: "quiz",
        text: "char c = 300; — what's really in c?",
        choices: ["300", "44 (only the low byte fits)", "0", "It's an error"],
        answer: 1,
        explain: "One box holds 0–255, exactly like BitBot-8 taught you. C calls the box a char; the wraparound is the same.",
      },
    ],
  },
  {
    id: "u09.assignment",
    unit: 9,
    title: "= copies right into left",
    summary: "x = y is a copy, not a friendship. Trace both boxes.",
    steps: [
      {
        kind: "minic",
        text: "The most misread symbol in programming: =. It is NOT \"equals\" — it's \"copy the right side into the left box.\" Step this and watch: does changing y later touch x?",
        source: "int x;\nint y;\n\nint main() {\n  y = 7;\n  x = y;\n  y = 100;\n  return x;\n}",
        mode: "view",
        explain: "x stayed 7. The copy happened once, at the moment of the =. Boxes don't stay connected.",
      },
      {
        kind: "minic",
        text: "Swap puzzle (no pointers yet!): make a end up with b's starting value and b with a's. You'll need the spare box t — figure out the three copies.",
        source: "int a = 3;\nint b = 9;\nint t;\n\nint main() {\n  // three assignments here\n  return a * 10 + b;\n}",
        mode: "edit",
        check: { cases: [{ A: 93 }] },
        solution: "int a = 3;\nint b = 9;\nint t;\n\nint main() {\n  t = a;\n  a = b;\n  b = t;\n  return a * 10 + b;\n}",
        explain: "a = b; b = a; loses a forever — the first copy destroys the old value. The spare box saves it. (Old value destroyed, source unchanged — that's assignment.)",
      },
    ],
  },

  // --------------------------------------------------------------- Unit 10
  {
    id: "u10.if",
    unit: 10,
    title: "if compiles to JZ",
    summary: "An if is a test and a jump — exactly what you wrote in Unit 5.",
    steps: [
      {
        kind: "minic",
        text: "Step through an if/else and watch the right pane: the condition computes a number, then JZ skips the \"then\" part when it's 0. No new machinery — your Unit-5 jumps in a costume.",
        source: "int x = 3;\nint big;\n\nint main() {\n  if (x > 2) {\n    big = 1;\n  } else {\n    big = 0;\n  }\n  return big;\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Write max: return the LARGER of the two globals a and b. The tests try several pairs — no hardcoding!",
        source: "int a;\nint b;\n\nint main() {\n  // return the larger one\n  return 0;\n}",
        mode: "edit",
        check: {
          cases: [
            { symbols: { a: 9, b: 4 }, A: 9 },
            { symbols: { a: 2, b: 8 }, A: 8 },
            { symbols: { a: 5, b: 5 }, A: 5 },
          ],
        },
        solution: "int a;\nint b;\n\nint main() {\n  if (a > b) {\n    return a;\n  }\n  return b;\n}",
        explain: "An if and a comparison — which you know is a SUB and a JNEG underneath.",
      },
      {
        kind: "quiz",
        text: "In C, == compares and = copies. What does \"if (x = 5)\" do? (Careful — this is a famous trap.)",
        choices: [
          "Checks whether x is 5",
          "COPIES 5 into x, then asks \"is 5 zero?\" — always true!",
          "Crashes",
        ],
        answer: 1,
        explain: "One symbol of difference, totally different meaning. The compiler view makes it visible: = emits a STORE, == emits a SUB and a jump.",
      },
    ],
  },
  {
    id: "u10.while",
    unit: 10,
    title: "while is your loop idiom",
    summary: "Condition at the top, jump out when done, jump back after the work.",
    steps: [
      {
        kind: "minic",
        text: "A while loop, compiled. Find the pieces in the assembly: the label at the top, the test, the JZ out, the JUMP back. You have hand-written every one of those.",
        source: "int total;\nint count = 5;\n\nint main() {\n  while (count != 0) {\n    total = total + 2;\n    count = count - 1;\n  }\n  return total;\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Write the classic: sum the numbers 1 through n (n is a global the tests will set). while-loop it.",
        source: "int n;\n\nint main() {\n  // sum 1..n and return it\n  return 0;\n}",
        mode: "edit",
        check: {
          cases: [
            { symbols: { n: 5 }, A: 15 },
            { symbols: { n: 10 }, A: 55 },
            { symbols: { n: 0 }, A: 0 },
          ],
        },
        solution:
          "int n;\n\nint main() {\n  int sum = 0;\n  int i = 1;\n  while (i <= n) {\n    sum = sum + i;\n    i = i + 1;\n  }\n  return sum;\n}",
        explain: "Loop boundaries again: i <= n, not i < n — off-by-one bugs followed you into C, and so did your trace-it instinct.",
      },
    ],
  },
  {
    id: "u10.for",
    unit: 10,
    title: "for: while in a trench coat",
    summary: "for(start; test; step) is exactly a while — the compiler proves it.",
    steps: [
      {
        kind: "minic",
        text: "C programmers love this shorthand-of-a-shorthand: for. Start, test, step — all on one line. Step through and check the assembly: could you tell it apart from the while version? (You can't. It IS the while version.)",
        source: "int total;\n\nint main() {\n  for (int i = 1; i <= 4; i = i + 1) {\n    total = total + i;\n  }\n  return total;\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Use a for loop to count how many multiples of 3 there are from 1 to 20 (hint: i % 3 == 0).",
        source: "int main() {\n  int hits = 0;\n  // for loop here\n  return hits;\n}",
        mode: "edit",
        check: { cases: [{ A: 6 }] },
        solution:
          "int main() {\n  int hits = 0;\n  for (int i = 1; i <= 20; i = i + 1) {\n    if (i % 3 == 0) {\n      hits = hits + 1;\n    }\n  }\n  return hits;\n}",
        explain: "3, 6, 9, 12, 15, 18 — six of them. (And % is another compiler-written loop. Check for CALL __mod!)",
      },
    ],
  },

  // --------------------------------------------------------------- Unit 11
  {
    id: "u11.functions",
    unit: 11,
    title: "Functions: CALL with luggage",
    summary: "Parameters travel on the stack; the answer comes back in A.",
    steps: [
      {
        kind: "minic",
        text: "A C function IS your Unit-7 routine — CALL, RET, answer in A — plus luggage: parameters ride the stack. Step this slowly with an eye on SP: watch the arguments get PUSHed before the CALL and the frame appear.",
        source: "int add(int a, int b) {\n  return a + b;\n}\n\nint main() {\n  return add(30, 12);\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Parameters are COPIES (remember tryChange?). Step it: doubleIt gets its own box holding 5; the global g never changes. This is why next unit needs pointers!",
        source: "int g = 5;\n\nint doubleIt(int x) {\n  x = x * 2;\n  return x;\n}\n\nint main() {\n  doubleIt(g);\n  return g;\n}",
        mode: "view",
        explain: "main still returns 5. The function doubled its own copy and the copy died with the frame.",
      },
      {
        kind: "minic",
        text: "Write square(n) — returns n times n — and use it: main should return square(3) + square(4).",
        source: "// write square here\n\nint main() {\n  return 0; // use square!\n}",
        mode: "edit",
        check: { cases: [{ A: 25 }] },
        solution:
          "int square(int n) {\n  return n * n;\n}\n\nint main() {\n  return square(3) + square(4);\n}",
        explain: "9 + 16 = 25. Two calls, two frames, each with its own n — the stack kept them straight.",
      },
    ],
  },
  {
    id: "u11.scope",
    unit: 11,
    title: "Frames die, boxes recycle",
    summary: "A local lives exactly as long as its function's stack frame.",
    steps: [
      {
        kind: "minic",
        text: "Where do locals LIVE? In the frame — stack boxes reached with LOADS/STORES (\"the word N boxes above SP\"). Step this and watch the stack region of memory: ghost()'s local appears, gets 99, and the frame vanishes at RET. Then haunt()'s frame lands on the SAME boxes.",
        source:
          "int ghost() {\n  int secret = 99;\n  return secret;\n}\n\nint haunt() {\n  int fresh = 1;\n  return fresh;\n}\n\nint main() {\n  ghost();\n  return haunt();\n}",
        mode: "view",
        explain: "haunt()'s frame overwrote ghost()'s old boxes. That's scope: not a rule about names, a fact about recycled memory.",
      },
      {
        kind: "quiz",
        text: "Why can't main use ghost's variable \"secret\"?",
        choices: [
          "The compiler hides it to be annoying",
          "Its box was part of ghost's frame, which is gone — the box may already hold something else",
          "Variables are private property",
        ],
        answer: 1,
        explain: "Scope-as-incantation, busted. The box is recycled stack space — you watched another frame move in.",
      },
    ],
  },
  {
    id: "u11.recursion",
    unit: 11,
    title: "Recursion: the stack does the work",
    summary: "A function that calls itself — safely this time, with a stopping rule.",
    steps: [
      {
        kind: "minic",
        text: "Unit 7's stack-eating monster, TAMED: a function may call itself if it has a stopping rule (the \"base case\"). factorial(4) stacks up four frames — watch SP dive and resurface. Each frame holds its own n!",
        source:
          "int fact(int n) {\n  if (n == 0) {\n    return 1;\n  }\n  return n * fact(n - 1);\n}\n\nint main() {\n  return fact(4);\n}",
        mode: "view",
        explain: "4 × 3 × 2 × 1 = 24, computed on the way back UP as the frames pop. Without the n == 0 rule, you know exactly what happens — you watched it eat the program once.",
      },
      {
        kind: "minic",
        text: "Write countdownSum(n) recursively: it returns n + countdownSum(n − 1), and 0 when n is 0. main returns countdownSum(10).",
        source: "// recursive countdownSum here\n\nint main() {\n  return 0;\n}",
        mode: "edit",
        check: { cases: [{ A: 55 }] },
        solution:
          "int countdownSum(int n) {\n  if (n == 0) {\n    return 0;\n  }\n  return n + countdownSum(n - 1);\n}\n\nint main() {\n  return countdownSum(10);\n}",
      },
    ],
  },

  // --------------------------------------------------------------- Unit 12
  {
    id: "u12.address_of",
    unit: 12,
    title: "& is \"address of\" (you've known this since Unit 1)",
    summary: "&x is x's box number. A pointer variable is a box holding it.",
    steps: [
      {
        kind: "minic",
        text: "Deep breath: pointers in C. &x means \"the ADDRESS of x's box\" — a number, the kind you've written since Unit 1. int* p means \"p's box holds an address of an int\". Step it: find p in the data section and watch x's address land in it.",
        source: "int x = 7;\nint* p;\n\nint main() {\n  p = &x;\n  return *p;\n}",
        mode: "view",
        explain: "*p (\"follow p\") compiled to LOADP — the arrow instruction from Unit 6. New clothes, old friend.",
      },
      {
        kind: "minic",
        text: "And writing through a pointer? *p = 3; — look at the assembly. There it is: STOREP. You have been doing C pointers since Unit 6.",
        source: "int x;\nint* p;\n\nint main() {\n  p = &x;\n  *p = 3;\n  return x;\n}",
        mode: "view",
        explain: "x became 3 and no line ever said \"x =\". Whoever holds the address can reach the box. That's the power (and the danger).",
      },
      {
        kind: "quiz",
        text: "int* p = &x; — what is actually inside p's box?",
        choices: [
          "A copy of x",
          "x's box NUMBER — a plain number that we're using as an address",
          "A magical link to x",
        ],
        answer: 1,
        explain: "A pointer is a number, not a tether (§ the misconception list). Same answer as Unit 6, now in C.",
      },
    ],
  },
  {
    id: "u12.swap",
    unit: 12,
    title: "The swap that finally works",
    summary: "Pass addresses, not copies — now the function can reach the real boxes.",
    steps: [
      {
        kind: "minic",
        text: "Unit 11's heartbreak: parameters are copies, so swap(a, b) can't work. But pass the ADDRESSES and the function can follow them to the real boxes. Step it — watch *p and *q reach back into a and b.",
        source:
          "int a = 3;\nint b = 9;\n\nvoid swap(int* p, int* q) {\n  int t = *p;\n  *p = *q;\n  *q = t;\n}\n\nint main() {\n  swap(&a, &b);\n  return a * 10 + b;\n}",
        mode: "view",
        explain: "93: a is 9, b is 3. The copies were of the ADDRESSES — and a copied address still points at the same box.",
      },
      {
        kind: "minic",
        text: "Write addTo(target, amount): it adds amount into the int that target POINTS AT. main uses it to add 5 to the global score, twice.",
        source:
          "int score = 10;\n\n// void addTo(int* target, int amount) ...\n\nint main() {\n  // call addTo twice\n  return score;\n}",
        mode: "edit",
        check: { cases: [{ A: 20 }] },
        solution:
          "int score = 10;\n\nvoid addTo(int* target, int amount) {\n  *target = *target + amount;\n}\n\nint main() {\n  addTo(&score, 5);\n  addTo(&score, 5);\n  return score;\n}",
      },
    ],
  },
  {
    id: "u12.pointer_math",
    unit: 12,
    title: "Pointer + 1 is not number + 1",
    summary: "An int* steps by 2 boxes; a char* steps by 1. Sizes again!",
    steps: [
      {
        kind: "minic",
        text: "Here's the twist types were preparing you for: p + 1 means \"the NEXT int\", and ints are 2 boxes — so the address grows by 2. Step it and watch the arithmetic in the assembly (the index gets doubled before the ADD).",
        source:
          "int arr[3];\n\nint main() {\n  int* p = arr;\n  *p = 11;\n  *(p + 1) = 22;\n  *(p + 2) = 33;\n  return *(p + 1);\n}",
        mode: "view",
        explain: "arr's three ints sit at consecutive EVEN addresses. p+1 walked one int, two boxes. A char* would walk one box — the type sets the stride.",
      },
      {
        kind: "quiz",
        text: "p is an int* holding address 3000. What number is p + 2?",
        choices: ["3002", "3004 (two ints = four boxes)", "3200"],
        answer: 1,
        explain: "Pointer arithmetic is in ELEMENTS, scaled by the element's size. You can see it happen in the compiled code — it's not a rule to memorize, it's an observed fact.",
      },
    ],
  },
  {
    id: "u12.screen",
    unit: 12,
    title: "Your old friend, the framebuffer",
    summary: "char* screen = (char*)2048 — the screen is yours again, in C.",
    steps: [
      {
        kind: "minic",
        text: "The payoff. BitBot-16's screen is boxes 2048–3071 — so make a char* hold 2048 and the whole screen is *yours*. (char, because pixels are single bytes.) Step it: STOREPB paints, exactly like your Unit-6 walks.",
        source:
          "char* screen = (char*)2048;\n\nint main() {\n  *screen = 3;\n  *(screen + 1) = 5;\n  *(screen + 33) = 9;\n  return 0;\n}",
        mode: "view",
        explain: "Row 1, pixel 1 is offset 33 (32 pixels per row + 1). The screen is a 1,024-byte array wearing a TV costume.",
      },
      {
        kind: "minic",
        text: "Paint the entire top row (offsets 0–31) with color 6, using a loop and your screen pointer.",
        source: "char* screen = (char*)2048;\n\nint main() {\n  // loop over the row\n  return 0;\n}",
        mode: "edit",
        check: {
          cases: [
            {
              cells: { 2048: 6, 2055: 6, 2063: 6, 2079: 6, 2080: 0 },
            },
          ],
          maxSteps: 2_000_000,
        },
        solution:
          "char* screen = (char*)2048;\n\nint main() {\n  for (int i = 0; i < 32; i = i + 1) {\n    *(screen + i) = 6;\n  }\n  return 0;\n}",
        explain: "Box 2080 (start of row 1) had to stay 0 — boundaries forever. Compare this to your Unit-6 row painter: same program, nicer clothes.",
      },
    ],
  },

  // --------------------------------------------------------------- Unit 13
  {
    id: "u13.arrays",
    unit: 13,
    title: "Arrays: boxes in a row",
    summary: "a[i] is *(a + i) — literally. The compiler shows its work.",
    steps: [
      {
        kind: "minic",
        text: "An array is contiguous boxes with one name. And the [ ] you've seen everywhere? Pure shorthand: a[i] compiles EXACTLY like *(a + i). Step both lines and compare their assembly — same instructions.",
        source:
          "int a[4];\n\nint main() {\n  a[2] = 7;\n  return *(a + 2);\n}",
        mode: "view",
        explain: "Index from 0 isn't a convention to memorize — a[0] is *(a + 0), the box AT the start. The math decides.",
      },
      {
        kind: "minic",
        text: "Fill the array so a[i] holds i times 10 (a[0]=0, a[1]=10, … a[4]=40), with a loop.",
        source: "int a[5];\n\nint main() {\n  // loop here\n  return a[3];\n}",
        mode: "edit",
        check: { cases: [{ A: 30 }] },
        solution:
          "int a[5];\n\nint main() {\n  for (int i = 0; i < 5; i = i + 1) {\n    a[i] = i * 10;\n  }\n  return a[3];\n}",
      },
    ],
  },
  {
    id: "u13.strings",
    unit: 13,
    title: "Strings: char arrays with a 0 at the end",
    summary: "Text is bytes; the 0 byte says \"stop here\". Write strlen yourself.",
    steps: [
      {
        kind: "minic",
        text: "\"hello\" is five char boxes — 104, 101, 108, 108, 111 — plus a secret sixth box holding 0. The 0 is the period at the end of the sentence: it's how anyone knows where the text stops. Step strlen, the find-the-end loop. (Check the data section for the bytes!)",
        source:
          'char* msg = "hello";\n\nint strlen(char* s) {\n  int n = 0;\n  while (*(s + n) != 0) {\n    n = n + 1;\n  }\n  return n;\n}\n\nint main() {\n  return strlen(msg);\n}',
        mode: "view",
        explain: "Strings end at 0 — not at the edge of anything. Lose the 0 and the loop keeps walking into the neighbors…",
      },
      {
        kind: "minic",
        text: "Write countLetter(s, c): how many times does byte c appear in string s (before the ending 0)? main counts the letter 108 ('l') in \"hello well\".",
        source:
          'char* msg = "hello well";\n\n// countLetter here\n\nint main() {\n  return 0;\n}',
        mode: "edit",
        check: { cases: [{ A: 4 }] },
        solution:
          'char* msg = "hello well";\n\nint countLetter(char* s, int c) {\n  int n = 0;\n  int i = 0;\n  while (*(s + i) != 0) {\n    if (*(s + i) == c) {\n      n = n + 1;\n    }\n    i = i + 1;\n  }\n  return n;\n}\n\nint main() {\n  return countLetter(msg, 108);\n}',
      },
    ],
  },
  {
    id: "u13.overrun",
    unit: 13,
    title: "Past the edge (breaking it on purpose)",
    summary: "Write one box past an array and SOMETHING else gets corrupted.",
    steps: [
      {
        kind: "minic",
        text: "Time to break things on purpose. buf has boxes 0–3. We write to buf[4] — one past the end. C does NOT stop you. Step it and watch the variable that lives next door get clobbered.",
        source:
          "char buf[4];\nchar victim = 7;\n\nint main() {\n  buf[4] = 99;\n  return victim;\n}",
        mode: "view",
        explain: "victim became 99 and no line mentioned victim. The array's neighbor was just… the next box. This bug family (buffer overruns) has crashed spaceships and leaked secrets — and you can SEE why it happens.",
      },
      {
        kind: "quiz",
        text: "Why didn't the machine refuse to write buf[4]?",
        choices: [
          "It should have — it's broken",
          "buf[4] is just *(buf + 4): a perfectly normal STORE to a perfectly real box. The machine executes steps, not intentions",
          "Arrays grow when you need more room",
        ],
        answer: 1,
        explain: "The superbug, one last time: nothing in the machine knows where your array \"ends\". Only your loop boundaries do.",
      },
    ],
  },

  // --------------------------------------------------------------- Unit 14
  {
    id: "u14.structs",
    unit: 14,
    title: "Structs: boxes glued together",
    summary: "A struct is fields at fixed offsets from a base address.",
    steps: [
      {
        kind: "minic",
        text: "A struct glues related boxes together: a point is its x (offset 0) and its y (offset 2 — right after a 2-box int). Field access is base + offset; find the ADD with the offset constant in the assembly.",
        source:
          "struct point { int x; int y; };\nstruct point p;\n\nint main() {\n  p.x = 3;\n  p.y = 4;\n  return p.x * 10 + p.y;\n}",
        mode: "view",
        explain: "p.y compiled to \"p's address + 2\". No magic: a struct is an address and a map of offsets.",
      },
      {
        kind: "minic",
        text: "Make a struct rect with width and height, set it to 6 by 7, and return its area.",
        source: "// struct rect { ... };\n// declare one globally\n\nint main() {\n  return 0;\n}",
        mode: "edit",
        check: { cases: [{ A: 42 }] },
        solution:
          "struct rect { int width; int height; };\nstruct rect r;\n\nint main() {\n  r.width = 6;\n  r.height = 7;\n  return r.width * r.height;\n}",
      },
    ],
  },
  {
    id: "u14.sprites",
    unit: 14,
    title: "Sprites: structs drive the screen",
    summary: "An array of {x, y, color} structs, painted in a loop.",
    steps: [
      {
        kind: "minic",
        text: "Game programming, for real: a SPRITE is a struct (x, y, color), and the screen position is screen + y*32 + x. Step the painter — three sprites land on the screen from one loop.",
        source:
          "struct sprite { int x; int y; char color; };\nstruct sprite s[3];\nchar* screen = (char*)2048;\n\nvoid draw(struct sprite* sp) {\n  *(screen + sp->y * 32 + sp->x) = sp->color;\n}\n\nint main() {\n  s[0].x = 1; s[0].y = 1; s[0].color = 3;\n  s[1].x = 5; s[1].y = 2; s[1].color = 5;\n  s[2].x = 8; s[2].y = 8; s[2].color = 9;\n  for (int i = 0; i < 3; i = i + 1) {\n    draw(&s[i]);\n  }\n  return 0;\n}",
        mode: "view",
        explain: "sp->color is (*sp).color: follow the pointer, add the offset. An array of structs is rows of glued boxes — the memory grid shows the pattern.",
      },
      {
        kind: "minic",
        text: "Your turn: set the global sprite \"dot\" to x=4, y=2, color 7, and paint it at screen + y*32 + x.",
        source:
          "struct sprite { int x; int y; char color; };\nstruct sprite dot;\nchar* screen = (char*)2048;\n\nint main() {\n  // set fields, then paint\n  return 0;\n}",
        mode: "edit",
        check: {
          cases: [{ cells: { [2048 + 2 * 32 + 4]: 7 } }],
          maxSteps: 2_000_000,
        },
        solution:
          "struct sprite { int x; int y; char color; };\nstruct sprite dot;\nchar* screen = (char*)2048;\n\nint main() {\n  dot.x = 4;\n  dot.y = 2;\n  dot.color = 7;\n  *(screen + dot.y * 32 + dot.x) = dot.color;\n  return 0;\n}",
      },
    ],
  },

  // --------------------------------------------------------------- Unit 15
  {
    id: "u15.game_loop",
    unit: 15,
    title: "The game loop",
    summary: "Move, draw, repeat — a bouncing dot is the whole curriculum in 20 lines.",
    steps: [
      {
        kind: "minic",
        text: "Every game is one loop: erase, move, draw, repeat. Here's a dot bouncing across the top row — run it FAST and watch the screen. Velocity flips at the walls: an if, a multiply by −1… you know every single piece.",
        source:
          "char* screen = (char*)2048;\nint x = 0;\nint vx = 1;\n\nint main() {\n  for (int t = 0; t < 60; t = t + 1) {\n    *(screen + x) = 0;\n    x = x + vx;\n    if (x == 31) { vx = 0 - 1; }\n    if (x == 0) { vx = 1; }\n    *(screen + x) = 12;\n  }\n  return x;\n}",
        mode: "view",
      },
      {
        kind: "minic",
        text: "Capstone kata: make the dot bounce VERTICALLY down the left column instead (offsets 0, 32, 64, … y*32). Same shape: flip vy at y==31 and y==0. The tests check where the dot ends after 40 ticks.",
        source:
          "char* screen = (char*)2048;\nint y = 0;\nint vy = 1;\n\nint main() {\n  for (int t = 0; t < 40; t = t + 1) {\n    // erase, move, bounce, draw\n  }\n  return y;\n}",
        mode: "edit",
        check: {
          // 40 ticks from y=0, bounce at 31: y goes 1..31 (31 ticks), then back down 9 → y=22
          cases: [{ A: 22, cells: { [2048 + 22 * 32]: 12 } }],
          maxSteps: 5_000_000,
        },
        solution:
          "char* screen = (char*)2048;\nint y = 0;\nint vy = 1;\n\nint main() {\n  for (int t = 0; t < 40; t = t + 1) {\n    *(screen + y * 32) = 0;\n    y = y + vy;\n    if (y == 31) { vy = 0 - 1; }\n    if (y == 0) { vy = 1; }\n    *(screen + y * 32) = 12;\n  }\n  return y;\n}",
        explain: "Open the Playground and load the Snake example — it's this loop with a body array, keyboard boxes, and collision. You can read ALL of it now.",
      },
    ],
  },
  {
    id: "u15.travel_guide",
    unit: 15,
    title: "Travel guide: real C",
    summary: "What changes when you leave BitBot for a grown-up computer.",
    steps: [
      {
        kind: "info",
        text: "You speak C now. Out there in \"real C\" the language is the same — but the machine under it is bigger. The travel guide: (1) ints are usually 32 or 64 bits, not 16 — they hold billions. (2) Memory is gigabytes, and the OS says which parts are yours. (3) There's no memory-mapped screen; you print text with printf( ) and use libraries to draw. (4) There's a heap — a way to ask for more boxes while running (malloc). Different country, same grammar.",
      },
      {
        kind: "quiz",
        text: "On BitBot-16, 60000 + 10000 wraps to 4464. On a real 32-bit int, what's 60000 + 10000?",
        choices: [
          "4464 — wrapping is the same everywhere",
          "70000 — a 32-bit int has room for billions; it wraps too, just much further out",
          "Real C ints never wrap",
        ],
        answer: 1,
        explain: "Same rules, bigger box. (Real ints DO wrap eventually — around 2 billion — and that bug has a long history too.)",
      },
      {
        kind: "info",
        text: "Try it yourself: the Playground now has a REAL C sandbox — same C, 32-bit ints, printf, and a pixel( ) library standing in for your framebuffer. Port a program and spot the differences. Then: Snake awaits. Go build things. 🎓",
      },
    ],
  },
];
