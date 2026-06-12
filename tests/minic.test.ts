import { describe, expect, it } from "vitest";
import { compileC } from "../src/minic/compile";
import { parse, MiniCError } from "../src/minic/parser";
import { assemble } from "../src/asm/assemble";
import { createVM, run } from "../src/vm/vm";
import { VMState } from "../src/vm/types";

/** Compile, assemble, run; return final state. */
function runC(source: string, maxSteps = 2_000_000): VMState {
  const compiled = compileC(source);
  const { result, errors } = assemble(compiled.asm, "bb16");
  expect(errors).toEqual([]);
  const final = run(createVM(result!.bytes, 1, "bb16"), maxSteps);
  expect(final.error).toBeNull();
  expect(final.halted).toBe(true);
  return final;
}

/** Run and read a global int by symbol name. */
function runAndRead(source: string, global: string): number {
  const compiled = compileC(source);
  const { result } = assemble(compiled.asm, "bb16");
  const final = run(createVM(result!.bytes, 1, "bb16"), 2_000_000);
  expect(final.halted).toBe(true);
  expect(final.error).toBeNull();
  const addr = result!.symbols[global];
  expect(addr).toBeDefined();
  return final.memory[addr] | (final.memory[addr + 1] << 8);
}

describe("MiniC compiler: expressions and variables", () => {
  it("main returns its value in A", () => {
    expect(runC(`int main() { return 42; }`).A).toBe(42);
  });

  it("globals: declare, read, write (declarations reserve a box, §4 U9)", () => {
    expect(runAndRead(`int x; int main() { x = 7; x = x + 1; return 0; }`, "x")).toBe(8);
  });

  it("locals live in the stack frame", () => {
    expect(runC(`int main() { int a = 5; int b = 9; return a + b; }`).A).toBe(14);
  });

  it("arithmetic: + - * / % with precedence", () => {
    expect(runC(`int main() { return 2 + 3 * 4; }`).A).toBe(14);
    expect(runC(`int main() { return (2 + 3) * 4; }`).A).toBe(20);
    expect(runC(`int main() { return 17 / 5; }`).A).toBe(3);
    expect(runC(`int main() { return 17 % 5; }`).A).toBe(2);
    expect(runC(`int main() { return 100 - 33; }`).A).toBe(67);
  });

  it("unary minus and 16-bit wraparound", () => {
    expect(runC(`int main() { return -1; }`).A).toBe(65535);
    expect(runC(`int main() { return 0 - 70000; }`).A).toBe((65536 - (70000 % 65536)) % 65536);
  });

  it("comparisons produce 0/1", () => {
    expect(runC(`int main() { return 3 < 5; }`).A).toBe(1);
    expect(runC(`int main() { return 5 < 3; }`).A).toBe(0);
    expect(runC(`int main() { return 5 <= 5; }`).A).toBe(1);
    expect(runC(`int main() { return 5 >= 6; }`).A).toBe(0);
    expect(runC(`int main() { return 4 == 4; }`).A).toBe(1);
    expect(runC(`int main() { return 4 != 4; }`).A).toBe(0);
  });

  it("&& and || short-circuit", () => {
    const src = `
int hits;
int bump() { hits = hits + 1; return 1; }
int main() {
  int a = 0 && bump();
  int b = 1 || bump();
  return hits * 10 + a * 2 + b;
}`;
    expect(runC(src).A).toBe(1); // bump never ran
  });

  it("char globals are one byte", () => {
    const src = `char c; int main() { c = 300; return c; }`;
    expect(runC(src).A).toBe(300 & 0xff); // char truncates: types are sizes (§4 U9)
  });
});

describe("MiniC compiler: control flow (Unit 10 semantics)", () => {
  it("if/else", () => {
    expect(runC(`int main() { if (2 < 3) return 1; else return 2; }`).A).toBe(1);
    expect(runC(`int main() { if (3 < 2) return 1; else return 2; }`).A).toBe(2);
  });

  it("while loop: sum 1..10", () => {
    const src = `
int main() {
  int sum = 0;
  int i = 1;
  while (i <= 10) { sum = sum + i; i = i + 1; }
  return sum;
}`;
    expect(runC(src).A).toBe(55);
  });

  it("for is while-shorthand: identical result", () => {
    const src = `
int main() {
  int sum = 0;
  for (int i = 1; i <= 10; i = i + 1) { sum = sum + i; }
  return sum;
}`;
    expect(runC(src).A).toBe(55);
  });
});

describe("MiniC compiler: functions (Unit 11 semantics)", () => {
  it("parameters and return values", () => {
    const src = `
int add(int a, int b) { return a + b; }
int main() { return add(3, add(4, 5)); }`;
    expect(runC(src).A).toBe(12);
  });

  it("recursion: factorial through the stack", () => {
    const src = `
int fact(int n) {
  if (n == 0) return 1;
  return n * fact(n - 1);
}
int main() { return fact(6); }`;
    expect(runC(src).A).toBe(720);
  });

  it("parameters are copies (§10): changing a param doesn't touch the caller", () => {
    const src = `
int g;
int tryChange(int x) { x = 99; return x; }
int main() { g = 5; tryChange(g); return g; }`;
    expect(runC(src).A).toBe(5);
  });
});

describe("MiniC compiler: pointers (Unit 12, the payoff)", () => {
  it("& and * on globals: swap via pointers", () => {
    const src = `
int a; int b;
void swap(int* p, int* q) {
  int t = *p;
  *p = *q;
  *q = t;
}
int main() { a = 3; b = 9; swap(&a, &b); return a * 10 + b; }`;
    expect(runC(src).A).toBe(93);
  });

  it("*p = 3 becomes STOREP (compiler view honesty)", () => {
    const compiled = compileC(`int x; int main() { int* p = &x; *p = 3; return x; }`);
    expect(compiled.asm).toContain("STOREP");
  });

  it("pointer arithmetic scales by the pointee size: int* steps by 2", () => {
    const src = `
int arr[4];
int main() {
  int* p = arr;
  *p = 10;
  *(p + 1) = 20;
  return arr[1];
}`;
    expect(runC(src).A).toBe(20);
  });

  it("char* steps by 1 and the framebuffer is just memory", () => {
    const src = `
int main() {
  char* screen = (char*)2048;
  *screen = 5;
  *(screen + 1) = 6;
  return 0;
}`;
    const final = runC(src);
    expect(final.memory[2048]).toBe(5);
    expect(final.memory[2049]).toBe(6);
  });

  it("taking the address of a local is a child-friendly error", () => {
    expect(() => compileC(`int main() { int a = 1; int* p = &a; return 0; }`)).toThrow(
      /GLOBAL box/
    );
  });
});

describe("MiniC compiler: arrays and strings (Unit 13)", () => {
  it("a[i] == *(a + i), by construction", () => {
    const src = `
int a[5];
int main() {
  a[2] = 7;
  return *(a + 2);
}`;
    expect(runC(src).A).toBe(7);
  });

  it("char arrays index by bytes", () => {
    const src = `
char buf[10];
int main() {
  buf[0] = 65;
  buf[1] = 66;
  return buf[0] * 1000 + buf[1];
}`;
    expect(runC(src).A).toBe(65066);
  });

  it("strings end at 0: hand-written strlen", () => {
    const src = `
char* msg = "hello";
int strlen(char* s) {
  int n = 0;
  while (*(s + n) != 0) { n = n + 1; }
  return n;
}
int main() { return strlen(msg); }`;
    expect(runC(src).A).toBe(5);
  });

  it("buffer overrun corrupts the neighbor — on purpose (§4 U13)", () => {
    const src = `
char buf[2];
char victim;
int main() {
  victim = 7;
  buf[2] = 99;   // one past the end!
  return victim;
}`;
    expect(runC(src).A).toBe(99);
  });
});

describe("MiniC compiler: structs (Unit 14)", () => {
  it("field access is base+offset", () => {
    const src = `
struct point { int x; int y; };
struct point p;
int main() {
  p.x = 3;
  p.y = 4;
  return p.x * 10 + p.y;
}`;
    expect(runC(src).A).toBe(34);
  });

  it("arrays of structs: a sprite table", () => {
    const src = `
struct sprite { int x; int y; char color; };
struct sprite s[3];
int main() {
  s[0].color = 1;
  s[2].x = 30;
  s[2].color = 9;
  return s[2].x + s[2].color;
}`;
    expect(runC(src).A).toBe(39);
  });

  it("-> reaches through a pointer", () => {
    const src = `
struct point { int x; int y; };
struct point p;
int main() {
  struct point* q = &p;
  q->x = 11;
  return p.x;
}`;
    expect(runC(src).A).toBe(11);
  });
});

describe("MiniC compiler: source map for synced stepping (§7 acceptance)", () => {
  it("every emitted instruction maps to a real C line", () => {
    const src = `int x;
int main() {
  x = 1;
  x = x + 1;
  return x;
}`;
    const compiled = compileC(src);
    const cLines = src.split("\n");
    for (const [, cLine] of Object.entries(compiled.lineMap)) {
      expect(cLine).toBeGreaterThanOrEqual(0);
      expect(cLine).toBeLessThan(cLines.length);
    }
    // the assignment line is represented in the map
    expect(Object.values(compiled.lineMap)).toContain(2);
    expect(Object.values(compiled.lineMap)).toContain(3);
  });

  it("stepping highlights the correct C line for every instruction", () => {
    const src = `int main() {
  int a = 5;
  return a;
}`;
    const compiled = compileC(src);
    const { result } = assemble(compiled.asm, "bb16");
    let s = createVM(result!.bytes, 1, "bb16");
    let sawDecl = false;
    for (let i = 0; i < 200 && !s.halted; i++) {
      const asmLine = result!.addrToLine[s.PC];
      const cLine = compiled.lineMap[asmLine];
      if (cLine === 1) sawDecl = true;
      s = run(s, 1);
    }
    expect(sawDecl).toBe(true);
  });
});

describe("MiniC: child-friendly errors", () => {
  const errOf = (src: string): string => {
    try {
      compileC(src);
      return "";
    } catch (e) {
      return e instanceof MiniCError ? e.message : String(e);
    }
  };

  it("unknown variable gets did-you-mean", () => {
    expect(errOf(`int count; int main() { cont = 1; return 0; }`)).toMatch(/did you mean "count"/);
  });

  it("unknown function gets did-you-mean", () => {
    const src = `int draw() { return 1; } int main() { drow(); return 0; }`;
    expect(errOf(src)).toMatch(/did you mean "draw"/);
  });

  it("missing main explained", () => {
    expect(errOf(`int helper() { return 1; }`)).toMatch(/main/);
  });

  it("wrong argument count explained", () => {
    expect(errOf(`int f(int a) { return a; } int main() { return f(1, 2); }`)).toMatch(/wants 1 value/);
  });

  it("missing semicolon points at the line", () => {
    try {
      parse(`int main() {\n  int a = 1\n  return a;\n}`);
      expect.unreachable();
    } catch (e) {
      expect((e as MiniCError).line).toBe(3);
    }
  });
});

describe("differential semantics: MiniC vs reference evaluation (§7 Phase-4 acceptance)", () => {
  // Small corpus of programs whose results we can compute in JS with the
  // same 16-bit semantics — the differential-test idea from the design doc.
  const wrap = (n: number) => ((n % 65536) + 65536) % 65536;

  const cases: { name: string; src: string; expected: number }[] = [
    {
      name: "triangular numbers",
      src: `int main() { int s = 0; for (int i = 0; i < 100; i = i + 1) { s = s + i; } return s; }`,
      expected: 4950,
    },
    {
      name: "nested loops",
      src: `int main() { int s = 0; for (int i = 0; i < 7; i = i + 1) { for (int j = 0; j < 5; j = j + 1) { s = s + i * j; } } return s; }`,
      expected: [...Array(7).keys()].reduce((acc, i) => acc + [0, 1, 2, 3, 4].reduce((a, j) => a + i * j, 0), 0),
    },
    {
      name: "fibonacci(15) iterative",
      src: `int main() { int a = 0; int b = 1; for (int i = 0; i < 15; i = i + 1) { int t = a + b; a = b; b = t; } return a; }`,
      expected: 610,
    },
    {
      name: "gcd recursive",
      src: `int gcd(int a, int b) { if (b == 0) return a; return gcd(b, a % b); } int main() { return gcd(1071, 462); }`,
      expected: 21,
    },
    {
      name: "16-bit overflow wraps",
      src: `int main() { return 60000 + 10000; }`,
      expected: wrap(70000),
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(runC(c.src).A).toBe(c.expected);
    });
  }
});
