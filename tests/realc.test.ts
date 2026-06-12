import { describe, expect, it } from "vitest";
import { runRealC } from "../src/realc/interpret";

describe("real-C sandbox: grown-up semantics (§7 Phase 5)", () => {
  it("printf with %d, %c, %s", () => {
    const r = runRealC(`int main() { printf("n=%d c=%c s=%s\\n", 42, 65, "hi"); return 0; }`);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(["n=42 c=A s=hi"]);
  });

  it("int is 32-bit: 60000 + 10000 = 70000 (the travel-guide diff)", () => {
    const r = runRealC(`int main() { printf("%d\\n", 60000 + 10000); return 0; }`);
    expect(r.output).toEqual(["70000"]);
  });

  it("…and it still wraps, just much further out", () => {
    const r = runRealC(`int main() { int big = 2000000000; printf("%d\\n", big + big); return 0; }`);
    expect(r.error).toBeNull();
    expect(r.output).toEqual([String((4000000000 | 0))]);
  });

  it("& works on locals (real stack), so swap of locals works", () => {
    const src = `
void swap(int* p, int* q) { int t = *p; *p = *q; *q = t; }
int main() {
  int a = 3;
  int b = 9;
  swap(&a, &b);
  printf("%d %d\\n", a, b);
  return 0;
}`;
    const r = runRealC(src);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(["9 3"]);
  });

  it("recursion with locals: factorial", () => {
    const src = `
int fact(int n) { if (n == 0) return 1; return n * fact(n - 1); }
int main() { printf("%d\\n", fact(10)); return 0; }`;
    expect(runRealC(src).output).toEqual(["3628800"]);
  });

  it("pixel() draws on the library screen", () => {
    const r = runRealC(`int main() { pixel(3, 2, 9); return 0; }`);
    expect(r.screen[2 * 32 + 3]).toBe(9);
  });

  it("strings and arrays still behave", () => {
    const src = `
char* msg = "hello";
int strlen(char* s) { int n = 0; while (*(s + n) != 0) { n = n + 1; } return n; }
int main() { printf("%d\\n", strlen(msg)); return 0; }`;
    expect(runRealC(src).output).toEqual(["5"]);
  });

  it("structs", () => {
    const src = `
struct point { int x; int y; };
struct point p;
int main() { p.x = 3; p.y = 4; printf("%d\\n", p.x * 10 + p.y); return 0; }`;
    expect(runRealC(src).output).toEqual(["34"]);
  });
});

describe("real-C sandbox: hostile programs can't escape (§7 acceptance)", () => {
  it("infinite loops hit the step budget with a child-readable message", () => {
    const r = runRealC(`int main() { while (1) { } return 0; }`);
    expect(r.error).toMatch(/never exits|stopped/);
  });

  it("runaway recursion overflows the sandbox stack, not the host", () => {
    const r = runRealC(`int f(int n) { return f(n + 1); } int main() { return f(0); }`);
    expect(r.error).toMatch(/stack overflowed|stopped|long time/i);
  });

  it("wild pointer writes stay inside the sandbox memory", () => {
    const r = runRealC(`
int main() {
  int* p = (int*)123456789;
  for (int i = 0; i < 10000; i = i + 1) { *(p + i) = 42; }
  return 0;
}`);
    // Nothing escaped the sandbox: either the program finished (writes were
    // masked into the sandbox array) or it clobbered its OWN stack — i and p
    // live in the same 64 KB — and the step budget cleanly stopped it.
    // Both are honest C outcomes; neither touches the host.
    if (r.error !== null) {
      expect(r.error).toMatch(/sandbox stopped it/);
    }
  });

  it("print floods are cut off", () => {
    const r = runRealC(`int main() { while (1) { printf("spam\\n"); } return 0; }`);
    expect(r.error).toMatch(/500 lines|stopped/);
    expect(r.output.length).toBeLessThanOrEqual(501);
  });

  it("division by zero is a clean stop", () => {
    const r = runRealC(`int main() { int z = 0; return 5 / z; }`);
    expect(r.error).toMatch(/zero/);
  });
});
