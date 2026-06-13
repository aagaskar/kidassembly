import {
  CType,
  Expr,
  FuncDef,
  MiniCError,
  parse,
  Program,
  Stmt,
  StructDef,
} from "../minic/parser";

/**
 * The "real C" sandbox (§7 Phase 5, option 1: an in-browser interpreter —
 * no server, sandboxed by construction). Same C subset as MiniC, but with
 * grown-up semantics for the Unit-15 travel guide:
 *
 * - int is 32-bit (wraps at ±2 billion, not 65,536);
 * - locals live in a real stack, so & works on locals;
 * - no memory-mapped screen: a tiny library instead — printf(fmt, …),
 *   pixel(x, y, color), rand(n);
 * - a hard step budget: hostile programs (infinite loops, runaway
 *   recursion) stop with a child-readable message, and all memory access
 *   is masked into one flat sandbox array — nothing outside is reachable.
 */

const MEM_SIZE = 1 << 16; // 64 KB sandbox
const INT_SIZE = 4;
const PTR_SIZE = 4;
const STEP_BUDGET = 2_000_000;
export const RC_SCREEN_W = 32;
export const RC_SCREEN_H = 32;

export interface RealCResult {
  output: string[];
  screen: Uint8Array; // 32×32 palette indices
  returnValue: number | null;
  error: string | null;
  steps: number;
}

class Halt {
  constructor(public value: number) {}
}
class Budget extends Error {}

const wrap32 = (n: number) => n | 0;

class Interp {
  mem = new Uint8Array(MEM_SIZE);
  screen = new Uint8Array(RC_SCREEN_W * RC_SCREEN_H);
  output: string[] = [];
  outBuf = "";
  steps = 0;
  sp = MEM_SIZE; // stack grows down
  heapTop = 16; // globals/strings allocated upward
  structs: Map<string, StructDef>;
  funcs = new Map<string, FuncDef>();
  globals = new Map<string, { addr: number; type: CType }>();
  rngState = 0x12345678;

  constructor(public program: Program) {
    this.structs = new Map(program.structs.map((s) => [s.name, s]));
    for (const f of program.funcs) this.funcs.set(f.name, f);
  }

  // ------------------------------------------------------------- types

  sizeOf(t: CType): number {
    switch (t.kind) {
      case "char":
        return 1;
      case "int":
        return INT_SIZE;
      case "ptr":
        return PTR_SIZE;
      case "void":
        return 0;
      case "array":
        return t.length * this.sizeOf(t.of);
      case "struct": {
        const def = this.structs.get(t.name);
        if (!def) throw new MiniCError(0, `I don't know a struct called "${t.name}".`);
        return def.fields.reduce((s, f) => s + this.sizeOf(f.type), 0);
      }
    }
  }

  fieldOffset(structName: string, field: string, line: number): { offset: number; type: CType } {
    const def = this.structs.get(structName);
    if (!def) throw new MiniCError(line, `I don't know a struct called "${structName}".`);
    let offset = 0;
    for (const f of def.fields) {
      if (f.name === field) return { offset, type: f.type };
      offset += this.sizeOf(f.type);
    }
    throw new MiniCError(line, `struct ${structName} has no field called "${field}".`);
  }

  // ------------------------------------------------------------ memory

  private mask(addr: number): number {
    return addr & (MEM_SIZE - 1); // the sandbox wall: all access stays inside
  }

  read(addr: number, t: CType): number {
    const a = this.mask(addr);
    const size = t.kind === "char" ? 1 : t.kind === "int" ? 4 : t.kind === "ptr" ? 4 : 4;
    if (size === 1) return this.mem[a];
    let v = 0;
    for (let i = 0; i < 4; i++) v |= this.mem[this.mask(a + i)] << (8 * i);
    return t.kind === "ptr" ? v >>> 0 : v | 0; // ints signed, pointers unsigned
  }

  write(addr: number, t: CType, value: number): void {
    const a = this.mask(addr);
    const size = t.kind === "char" ? 1 : 4;
    if (size === 1) {
      this.mem[a] = value & 0xff;
      return;
    }
    for (let i = 0; i < 4; i++) this.mem[this.mask(a + i)] = (value >> (8 * i)) & 0xff;
  }

  alloc(size: number): number {
    const addr = this.heapTop;
    this.heapTop += size;
    if (this.heapTop >= MEM_SIZE / 2) {
      throw new MiniCError(0, `The program asked for more memory than the sandbox has.`);
    }
    return addr;
  }

  allocString(s: string): number {
    const addr = this.alloc(s.length + 1);
    for (let i = 0; i < s.length; i++) this.mem[addr + i] = s.charCodeAt(i) & 0xff;
    this.mem[addr + s.length] = 0;
    return addr;
  }

  // ------------------------------------------------------- environment

  scopes: Map<string, { addr: number; type: CType }>[] = [];

  declareLocal(name: string, type: CType, line: number): { addr: number; type: CType } {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name)) {
      throw new MiniCError(line, `"${name}" is declared twice in the same function.`);
    }
    this.sp -= Math.max(this.sizeOf(type), 1);
    this.sp &= ~3; // keep the stack aligned
    // 16 KB of sandbox stack: deep recursion hits THIS wall (with a child-
    // readable message) before it can exhaust the host's call stack.
    if (this.sp < MEM_SIZE - 16384) {
      throw new MiniCError(line, `The stack overflowed — too many calls inside calls!`);
    }
    const slot = { addr: this.sp, type };
    scope.set(name, slot);
    return slot;
  }

  lookup(name: string, line: number): { addr: number; type: CType } {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const v = this.scopes[i].get(name);
      if (v) return v;
    }
    const g = this.globals.get(name);
    if (g) return g;
    throw new MiniCError(line, `I don't know a variable called "${name}".`);
  }

  // --------------------------------------------------------- execution

  tick(): void {
    if (++this.steps > STEP_BUDGET) {
      throw new Budget();
    }
  }

  typeOf(e: Expr): CType {
    // Lightweight typing, mirroring the compiler's rules.
    switch (e.kind) {
      case "num":
        return { kind: "int" };
      case "str":
        return { kind: "ptr", to: { kind: "char" } };
      case "var":
        return this.lookup(e.name, e.line).type;
      case "un":
        if (e.op === "&") return { kind: "ptr", to: this.typeOf(e.e) };
        if (e.op === "*") {
          const t = this.typeOf(e.e);
          if (t.kind === "ptr") return t.to;
          if (t.kind === "array") return t.of;
          throw new MiniCError(e.line, `* only works on pointers.`);
        }
        return { kind: "int" };
      case "bin": {
        if (["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(e.op)) return { kind: "int" };
        const lt = this.typeOf(e.l);
        const rt = this.typeOf(e.r);
        if (lt.kind === "ptr" || lt.kind === "array") return lt.kind === "array" ? { kind: "ptr", to: lt.of } : lt;
        if (rt.kind === "ptr" || rt.kind === "array") return rt.kind === "array" ? { kind: "ptr", to: rt.of } : rt;
        return { kind: "int" };
      }
      case "assign":
        return this.typeOf(e.target);
      case "call": {
        const f = this.funcs.get(e.name);
        return f ? f.ret : { kind: "int" }; // builtins return int
      }
      case "index": {
        const bt = this.typeOf(e.base);
        if (bt.kind === "array") return bt.of;
        if (bt.kind === "ptr") return bt.to;
        throw new MiniCError(e.line, `[ ] only works on arrays and pointers.`);
      }
      case "field": {
        const bt = this.typeOf(e.base);
        const st = e.arrow ? (bt.kind === "ptr" ? bt.to : bt) : bt;
        if (st.kind !== "struct") throw new MiniCError(e.line, `That isn't a struct.`);
        return this.fieldOffset(st.name, e.name, e.line).type;
      }
      case "cast":
        return e.type;
    }
  }

  addrOf(e: Expr): number {
    switch (e.kind) {
      case "var":
        return this.lookup(e.name, e.line).addr;
      case "str":
        return this.allocString(e.value);
      case "un":
        if (e.op === "*") return this.eval(e.e);
        break;
      case "index": {
        const bt = this.typeOf(e.base);
        const elem = bt.kind === "array" ? bt.of : bt.kind === "ptr" ? bt.to : ({ kind: "int" } as CType);
        const base = bt.kind === "array" ? this.addrOf(e.base) : this.eval(e.base);
        return base + this.eval(e.index) * this.sizeOf(elem);
      }
      case "field": {
        const bt = this.typeOf(e.base);
        const st = e.arrow ? (bt.kind === "ptr" ? bt.to : bt) : bt;
        if (st.kind !== "struct") throw new MiniCError(e.line, `That isn't a struct.`);
        const base = e.arrow ? this.eval(e.base) : this.addrOf(e.base);
        return base + this.fieldOffset(st.name, e.name, e.line).offset;
      }
      case "cast":
        return this.addrOf(e.e);
      default:
        break;
    }
    throw new MiniCError(e.line, `I can't take the address of that.`);
  }

  eval(e: Expr): number {
    this.tick();
    switch (e.kind) {
      case "num":
        return wrap32(e.value);
      case "str":
        return this.allocString(e.value);
      case "var": {
        const v = this.lookup(e.name, e.line);
        if (v.type.kind === "array" || v.type.kind === "struct") return v.addr; // decay
        return this.read(v.addr, v.type);
      }
      case "un":
        switch (e.op) {
          case "-":
            return wrap32(-this.eval(e.e));
          case "!":
            return this.eval(e.e) === 0 ? 1 : 0;
          case "&":
            return this.addrOf(e.e);
          case "*": {
            const t = this.typeOf(e.e);
            const pointee = t.kind === "ptr" ? t.to : t.kind === "array" ? t.of : ({ kind: "int" } as CType);
            return this.read(this.eval(e.e), pointee);
          }
        }
        break;
      case "bin": {
        if (e.op === "&&") return this.eval(e.l) !== 0 && this.eval(e.r) !== 0 ? 1 : 0;
        if (e.op === "||") return this.eval(e.l) !== 0 || this.eval(e.r) !== 0 ? 1 : 0;
        const lt = this.typeOf(e.l);
        const rt = this.typeOf(e.r);
        const l = this.eval(e.l);
        const r = this.eval(e.r);
        const scale = (t: CType) =>
          t.kind === "ptr" ? this.sizeOf(t.to) : t.kind === "array" ? this.sizeOf(t.of) : 1;
        switch (e.op) {
          case "+":
            if (lt.kind === "ptr" || lt.kind === "array") return l + r * scale(lt);
            if (rt.kind === "ptr" || rt.kind === "array") return r + l * scale(rt);
            return wrap32(l + r);
          case "-":
            if ((lt.kind === "ptr" || lt.kind === "array") && rt.kind !== "ptr" && rt.kind !== "array") {
              return l - r * scale(lt);
            }
            return wrap32(l - r);
          case "*":
            return wrap32(Math.imul(l, r));
          case "/":
            if (r === 0) throw new MiniCError(e.line, `Dividing by zero — the program stopped.`);
            return wrap32(Math.trunc(l / r));
          case "%":
            if (r === 0) throw new MiniCError(e.line, `Dividing by zero — the program stopped.`);
            return wrap32(l % r);
          case "==":
            return l === r ? 1 : 0;
          case "!=":
            return l !== r ? 1 : 0;
          case "<":
            return l < r ? 1 : 0;
          case ">":
            return l > r ? 1 : 0;
          case "<=":
            return l <= r ? 1 : 0;
          case ">=":
            return l >= r ? 1 : 0;
        }
        throw new MiniCError(e.line, `I don't know the operator "${e.op}".`);
      }
      case "assign": {
        const t = this.typeOf(e.target);
        const addr = this.addrOf(e.target);
        const v = this.eval(e.value);
        this.write(addr, t, v);
        return v;
      }
      case "call":
        return this.call(e);
      case "index": {
        const t = this.typeOf(e);
        return this.read(this.addrOf(e), t);
      }
      case "field": {
        const t = this.typeOf(e);
        if (t.kind === "array") return this.addrOf(e);
        return this.read(this.addrOf(e), t);
      }
      case "cast": {
        const v = this.eval(e.e);
        if (e.type.kind === "char") return v & 0xff;
        return v;
      }
    }
    throw new MiniCError(0, `internal: unhandled expression`);
  }

  readString(addr: number): string {
    let s = "";
    for (let i = 0; i < 4096; i++) {
      const b = this.mem[this.mask(addr + i)];
      if (b === 0) break;
      s += String.fromCharCode(b);
    }
    return s;
  }

  print(text: string): void {
    this.outBuf += text;
    let idx;
    while ((idx = this.outBuf.indexOf("\n")) >= 0) {
      this.output.push(this.outBuf.slice(0, idx));
      this.outBuf = this.outBuf.slice(idx + 1);
      if (this.output.length > 500) throw new MiniCError(0, `That's a LOT of printing — the sandbox stopped at 500 lines.`);
    }
  }

  call(e: Extract<Expr, { kind: "call" }>): number {
    const args = e.args.map((a) => this.eval(a));

    // ---- the tiny library (§7 Phase 5)
    switch (e.name) {
      case "printf": {
        if (e.args.length === 0) throw new MiniCError(e.line, `printf needs at least a "format" text.`);
        const fmt = this.readString(args[0]);
        let out = "";
        let argI = 1;
        for (let i = 0; i < fmt.length; i++) {
          if (fmt[i] === "%" && i + 1 < fmt.length) {
            const c = fmt[++i];
            if (c === "d") out += String(args[argI++] | 0);
            else if (c === "c") out += String.fromCharCode(args[argI++] & 0xff);
            else if (c === "s") out += this.readString(args[argI++]);
            else if (c === "%") out += "%";
            else out += "%" + c;
          } else {
            out += fmt[i];
          }
        }
        this.print(out);
        return 0;
      }
      case "pixel": {
        if (args.length !== 3) throw new MiniCError(e.line, `pixel needs (x, y, color).`);
        const [x, y, color] = args;
        if (x >= 0 && x < RC_SCREEN_W && y >= 0 && y < RC_SCREEN_H) {
          this.screen[y * RC_SCREEN_W + x] = color & 0xf;
        }
        return 0;
      }
      case "rand": {
        // deterministic xorshift so lessons replay identically
        let s = this.rngState | 0;
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        this.rngState = s;
        const n = args[0] || 256;
        return ((s >>> 1) % n + n) % n;
      }
      default:
        break;
    }

    const f = this.funcs.get(e.name);
    if (!f) {
      throw new MiniCError(
        e.line,
        `I don't know a function called "${e.name}". (The sandbox has printf, pixel, and rand built in.)`
      );
    }
    if (args.length !== f.params.length) {
      throw new MiniCError(e.line, `${f.name} wants ${f.params.length} value${f.params.length === 1 ? "" : "s"}, but got ${args.length}.`);
    }

    const savedSp = this.sp;
    this.scopes.push(new Map());
    try {
      f.params.forEach((p, i) => {
        const slot = this.declareLocal(p.name, p.type, f.line);
        this.write(slot.addr, p.type, args[i]);
      });
      this.execBlock(f.body);
      return 0; // fell off the end
    } catch (h) {
      if (h instanceof Halt) return h.value;
      throw h;
    } finally {
      this.scopes.pop();
      this.sp = savedSp; // frame dies, boxes recycled (§4 U11)
    }
  }

  execBlock(stmts: Stmt[]): void {
    for (const s of stmts) this.exec(s);
  }

  exec(s: Stmt): void {
    this.tick();
    switch (s.kind) {
      case "expr":
        this.eval(s.e);
        return;
      case "decl": {
        const slot = this.declareLocal(s.name, s.type, s.line);
        if (s.init) this.write(slot.addr, s.type, this.eval(s.init));
        else this.write(slot.addr, s.type, 0);
        return;
      }
      case "block":
        this.execBlock(s.body);
        return;
      case "if":
        if (this.eval(s.cond) !== 0) this.execBlock(s.then);
        else if (s.else_) this.execBlock(s.else_);
        return;
      case "while":
        while (this.eval(s.cond) !== 0) {
          this.tick();
          this.execBlock(s.body);
        }
        return;
      case "for": {
        if (s.init) this.exec(s.init);
        while (s.cond === null || this.eval(s.cond) !== 0) {
          this.tick();
          this.execBlock(s.body);
          if (s.post) this.eval(s.post);
        }
        return;
      }
      case "return":
        throw new Halt(s.e ? this.eval(s.e) : 0);
    }
  }

  run(): RealCResult {
    try {
      // globals
      for (const g of this.program.globals) {
        const addr = this.alloc(Math.max(this.sizeOf(g.type), 1));
        this.globals.set(g.name, { addr, type: g.type });
        if (typeof g.init === "number") this.write(addr, g.type, wrap32(g.init));
        else if (typeof g.init === "string") this.write(addr, g.type, this.allocString(g.init));
      }
      const main = this.funcs.get("main");
      if (!main) {
        throw new MiniCError(1, `Every C program needs a function called main.`);
      }
      const rv = this.call({ kind: "call", name: "main", args: [], line: main.line });
      if (this.outBuf) this.output.push(this.outBuf);
      return { output: this.output, screen: this.screen, returnValue: rv, error: null, steps: this.steps };
    } catch (err) {
      if (this.outBuf) this.output.push(this.outBuf);
      const message =
        err instanceof Budget
          ? "The program ran for a very long time without finishing — probably a loop that never exits. The sandbox stopped it."
          : err instanceof MiniCError
            ? `Line ${err.line}: ${err.message}`
            : err instanceof RangeError
              ? "The stack overflowed — too many calls inside calls! The sandbox stopped it."
              : String(err);
      return { output: this.output, screen: this.screen, returnValue: null, error: message, steps: this.steps };
    }
  }
}

export function runRealC(source: string): RealCResult {
  try {
    return new Interp(parse(source)).run();
  } catch (err) {
    const message =
      err instanceof MiniCError ? `Line ${err.line}: ${err.message}` : String(err);
    return {
      output: [],
      screen: new Uint8Array(RC_SCREEN_W * RC_SCREEN_H),
      returnValue: null,
      error: message,
      steps: 0,
    };
  }
}
