import {
  CType,
  Expr,
  FuncDef,
  INT,
  MiniCError,
  parse,
  Program,
  Stmt,
  StructDef,
  typeName,
} from "./parser";

/**
 * The MiniC → BitBot-16 compiler (§7 Phase 4).
 *
 * Design choices, all in service of a *legible* compiler view:
 * - One value register (A); expression temporaries go through the stack
 *   with a scratch word (__t0) for the second operand of binary ops.
 * - Locals and parameters are word slots in the stack frame, reached with
 *   LOADS/STORES at compiler-tracked offsets (§3.3).
 * - Arrays and structs live in global memory (declared at file scope);
 *   `&` works on globals only — locals have no fixed address on this ISA.
 * - `*`/`/`/`%` compile to CALLs into small runtime loops (repeated
 *   addition/subtraction) — visible work, not magic.
 *
 * Output is assembly TEXT plus an asm-line → C-line map, so the synced
 * stepping UI can chain PC → asm line → C line.
 */

export interface CompiledC {
  asm: string;
  /** asm line index → C source line index (0-based), or undefined. */
  lineMap: Record<number, number>;
  /** entry/global symbol info for tests and tooling */
  program: Program;
}

interface Line {
  text: string;
  cLine: number | null;
}

const WORD = 2;

export function sizeOf(t: CType, structs: Map<string, StructDef>): number {
  switch (t.kind) {
    case "char":
      return 1;
    case "int":
    case "ptr":
      return WORD;
    case "void":
      return 0;
    case "array":
      return t.length * sizeOf(t.of, structs);
    case "struct": {
      const def = structs.get(t.name);
      if (!def) throw new MiniCError(0, `I don't know a struct called "${t.name}".`);
      return def.fields.reduce((sum, f) => sum + sizeOf(f.type, structs), 0);
    }
  }
}

function fieldOffset(def: StructDef, field: string, structs: Map<string, StructDef>): {
  offset: number;
  type: CType;
} {
  let offset = 0;
  for (const f of def.fields) {
    if (f.name === field) return { offset, type: f.type };
    offset += sizeOf(f.type, structs);
  }
  throw new MiniCError(
    def.line,
    `struct ${def.name} has no field called "${field}". Its fields are: ${def.fields
      .map((f) => f.name)
      .join(", ")}.`
  );
}

function nearest(word: string, candidates: string[]): string | null {
  let best: string | null = null;
  for (const c of candidates) {
    if (c.length > 0 && (c.startsWith(word) || word.startsWith(c) || leven(word, c) <= 2)) {
      best = c;
      break;
    }
  }
  return best;
}

function leven(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

class Compiler {
  lines: Line[] = [];
  structs: Map<string, StructDef>;
  globals = new Map<string, { label: string; type: CType }>();
  funcs = new Map<string, FuncDef>();
  strings = new Map<string, string>(); // value → label
  consts = new Set<number>(); // pooled constants for ADD-immediate
  needsMul = false;
  needsDiv = false;
  needsMod = false;
  labelCounter = 0;

  // current function state
  locals = new Map<string, { slot: number; type: CType }>();
  params = new Map<string, { index: number; type: CType }>();
  nLocals = 0;
  nParams = 0;
  tempDepth = 0; // bytes currently pushed for expression temporaries

  constructor(public program: Program) {
    this.structs = new Map(program.structs.map((s) => [s.name, s]));
    for (const f of program.funcs) {
      if (this.funcs.has(f.name)) {
        throw new MiniCError(f.line, `There are two functions called "${f.name}".`);
      }
      this.funcs.set(f.name, f);
    }
    for (const g of program.globals) {
      if (this.globals.has(g.name)) {
        throw new MiniCError(g.line, `There are two globals called "${g.name}".`);
      }
      this.globals.set(g.name, { label: g.name, type: g.type });
    }
  }

  emit(text: string, cLine: number | null = null): void {
    this.lines.push({ text, cLine });
  }

  newLabel(hint: string): string {
    return `__${hint}${this.labelCounter++}`;
  }

  constLabel(n: number): string {
    const v = ((n % 65536) + 65536) % 65536;
    this.consts.add(v);
    return `__k${v}`;
  }

  strLabel(s: string): string {
    let label = this.strings.get(s);
    if (!label) {
      label = `__str${this.strings.size}`;
      this.strings.set(s, label);
    }
    return label;
  }

  // -------------------------------------------------------------- types

  typeOf(e: Expr): CType {
    switch (e.kind) {
      case "num":
        return INT;
      case "str":
        return { kind: "ptr", to: { kind: "char" } };
      case "var": {
        const local = this.locals.get(e.name);
        if (local) return local.type;
        const param = this.params.get(e.name);
        if (param) return param.type;
        const g = this.globals.get(e.name);
        if (g) return g.type;
        const all = [...this.locals.keys(), ...this.params.keys(), ...this.globals.keys()];
        const hint = nearest(e.name, all);
        throw new MiniCError(
          e.line,
          `I don't know a variable called "${e.name}"` + (hint ? ` — did you mean "${hint}"?` : ".")
        );
      }
      case "un":
        switch (e.op) {
          case "-":
          case "!":
            return INT;
          case "&": {
            return { kind: "ptr", to: this.typeOf(e.e) };
          }
          case "*": {
            const t = this.typeOf(e.e);
            if (t.kind === "ptr") return t.to;
            if (t.kind === "array") return t.of;
            throw new MiniCError(e.line, `* only works on pointers, and this is a ${typeName(t)}.`);
          }
        }
        break;
      case "bin": {
        if (["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(e.op)) return INT;
        const lt = this.typeOf(e.l);
        const rt = this.typeOf(e.r);
        if (e.op === "+" || e.op === "-") {
          if (lt.kind === "ptr" || lt.kind === "array") return lt.kind === "array" ? { kind: "ptr", to: lt.of } : lt;
          if (rt.kind === "ptr" || rt.kind === "array") return rt.kind === "array" ? { kind: "ptr", to: rt.of } : rt;
        }
        return INT;
      }
      case "assign":
        return this.typeOf(e.target);
      case "call": {
        const f = this.funcs.get(e.name);
        if (!f) {
          const hint = nearest(e.name, [...this.funcs.keys()]);
          throw new MiniCError(
            e.line,
            `I don't know a function called "${e.name}"` + (hint ? ` — did you mean "${hint}"?` : ".")
          );
        }
        return f.ret;
      }
      case "index": {
        const bt = this.typeOf(e.base);
        if (bt.kind === "array") return bt.of;
        if (bt.kind === "ptr") return bt.to;
        throw new MiniCError(e.line, `[ ] only works on arrays and pointers, and this is a ${typeName(bt)}.`);
      }
      case "field": {
        const bt = this.typeOf(e.base);
        const st = e.arrow
          ? bt.kind === "ptr" && bt.to.kind === "struct"
            ? bt.to
            : null
          : bt.kind === "struct"
            ? bt
            : null;
        if (!st || st.kind !== "struct") {
          throw new MiniCError(
            e.line,
            e.arrow
              ? `-> needs a pointer to a struct on its left.`
              : `. needs a struct on its left, and this is a ${typeName(bt)}.`
          );
        }
        const def = this.structs.get(st.name);
        if (!def) throw new MiniCError(e.line, `I don't know a struct called "${st.name}".`);
        return fieldOffset(def, e.name, this.structs).type;
      }
      case "cast":
        return e.type;
    }
    throw new MiniCError(0, "internal: unhandled expression");
  }

  /** Byte width a load/store through this type's pointee should move. */
  private widthOf(t: CType): 1 | 2 {
    return sizeOf(t, this.structs) === 1 ? 1 : 2;
  }

  // ------------------------------------------------------ local offsets

  private localOffset(slot: number): number {
    return WORD * (this.nLocals - 1 - slot) + this.tempDepth;
  }
  private paramOffset(index: number): number {
    return WORD * this.nLocals + WORD + WORD * (this.nParams - 1 - index) + this.tempDepth;
  }

  // -------------------------------------------------------- expressions

  /** Emit code leaving the expression's VALUE in A. */
  evalExpr(e: Expr): void {
    const c = e.line - 1;
    switch (e.kind) {
      case "num":
        this.emit(`LOADC ${((e.value % 65536) + 65536) % 65536}`, c);
        return;
      case "str":
        this.emit(`LOADC ${this.strLabel(e.value)}`, c);
        return;
      case "var": {
        const local = this.locals.get(e.name);
        if (local) {
          this.emit(`LOADS ${this.localOffset(local.slot)}`, c);
          return;
        }
        const param = this.params.get(e.name);
        if (param) {
          this.emit(`LOADS ${this.paramOffset(param.index)}`, c);
          return;
        }
        const g = this.globals.get(e.name);
        if (!g) {
          this.typeOf(e); // throws with did-you-mean
          return;
        }
        if (g.type.kind === "array" || g.type.kind === "struct") {
          this.emit(`LOADC ${g.label}`, c); // arrays/structs decay to address
        } else if (this.widthOf(g.type) === 1) {
          this.emit(`LOADB ${g.label}`, c);
        } else {
          this.emit(`LOAD ${g.label}`, c);
        }
        return;
      }
      case "un":
        switch (e.op) {
          case "-":
            this.evalExpr(e.e);
            this.emit(`STORE __t0`, c);
            this.emit(`LOADC 0`, c);
            this.emit(`SUB __t0`, c);
            return;
          case "!": {
            this.evalExpr(e.e);
            const yes = this.newLabel("one");
            const end = this.newLabel("end");
            this.emit(`JZ ${yes}`, c);
            this.emit(`LOADC 0`, c);
            this.emit(`JUMP ${end}`, c);
            this.emit(`${yes}: LOADC 1`, c);
            this.emit(`${end}:`, c);
            return;
          }
          case "&":
            this.evalAddr(e.e);
            return;
          case "*": {
            const t = this.typeOf(e.e);
            const pointee = t.kind === "ptr" ? t.to : t.kind === "array" ? t.of : INT;
            this.evalExpr(e.e); // pointer VALUE = target address
            this.loadThroughA(this.widthOf(pointee), c);
            return;
          }
        }
        return;
      case "bin":
        this.evalBin(e, c);
        return;
      case "assign":
        this.evalAssign(e, c);
        return;
      case "call":
        this.evalCall(e, c);
        return;
      case "index": {
        const elemT = this.typeOf(e);
        this.evalIndexAddr(e, c);
        this.loadThroughA(this.widthOf(elemT), c);
        return;
      }
      case "field": {
        const t = this.typeOf(e);
        this.evalFieldAddr(e, c);
        if (t.kind === "array") return; // array field decays to its address
        this.loadThroughA(this.widthOf(t), c);
        return;
      }
      case "cast":
        this.evalExpr(e.e);
        return;
    }
  }

  /** A holds an address; replace it with the value at that address. */
  private loadThroughA(width: 1 | 2, c: number | null): void {
    this.emit(`STORE __t0`, c);
    this.emit(width === 1 ? `LOADPB __t0` : `LOADP __t0`, c);
  }

  /** Emit code leaving the expression's ADDRESS in A (lvalues + &). */
  evalAddr(e: Expr): void {
    const c = e.line - 1;
    switch (e.kind) {
      case "var": {
        if (this.locals.has(e.name) || this.params.has(e.name)) {
          throw new MiniCError(
            e.line,
            `"${e.name}" lives in the stack frame, which moves around — MiniC can only take the address of a GLOBAL box. Declare it outside the function.`
          );
        }
        const g = this.globals.get(e.name);
        if (!g) {
          this.typeOf(e);
          return;
        }
        this.emit(`LOADC ${g.label}`, c);
        return;
      }
      case "str":
        this.emit(`LOADC ${this.strLabel(e.value)}`, c);
        return;
      case "un":
        if (e.op === "*") {
          this.evalExpr(e.e);
          return;
        }
        break;
      case "index":
        this.evalIndexAddr(e, c);
        return;
      case "field":
        this.evalFieldAddr(e, c);
        return;
      case "cast":
        this.evalAddr(e.e);
        return;
      default:
        break;
    }
    throw new MiniCError(e.line, `I can't take the address of that.`);
  }

  private evalIndexAddr(e: Extract<Expr, { kind: "index" }>, c: number | null): void {
    const bt = this.typeOf(e.base);
    const elem = bt.kind === "array" ? bt.of : bt.kind === "ptr" ? bt.to : INT;
    const size = sizeOf(elem, this.structs);
    // base address …
    if (bt.kind === "array") this.evalAddr(e.base);
    else this.evalExpr(e.base);
    this.push(c);
    // … plus index × size
    this.evalExpr(e.index);
    this.scaleA(size, c);
    this.emit(`STORE __t0`, c);
    this.pop(c);
    this.emit(`ADD __t0`, c);
  }

  private evalFieldAddr(e: Extract<Expr, { kind: "field" }>, c: number | null): void {
    const bt = this.typeOf(e.base);
    const structT = e.arrow ? (bt.kind === "ptr" ? bt.to : bt) : bt;
    if (structT.kind !== "struct") throw new MiniCError(e.line, `That isn't a struct.`);
    const def = this.structs.get(structT.name)!;
    const { offset } = fieldOffset(def, e.name, this.structs);
    if (e.arrow) this.evalExpr(e.base);
    else this.evalAddr(e.base);
    if (offset !== 0) {
      this.emit(`ADD ${this.constLabel(offset)}`, c);
    }
  }

  /** Multiply A by a constant size (1, 2, or anything via the runtime). */
  private scaleA(size: number, c: number | null): void {
    if (size === 1) return;
    if (size === 2) {
      this.emit(`STORE __t0`, c);
      this.emit(`ADD __t0`, c); // A + A = 2A
      return;
    }
    this.needsMul = true;
    this.emit(`STORE __ma`, c);
    this.emit(`LOADC ${size}`, c);
    this.emit(`STORE __mb`, c);
    this.emit(`CALL __mul`, c);
  }

  private push(c: number | null): void {
    this.emit(`PUSH`, c);
    this.tempDepth += WORD;
  }
  private pop(c: number | null): void {
    this.emit(`POP`, c);
    this.tempDepth -= WORD;
  }

  private evalBin(e: Extract<Expr, { kind: "bin" }>, c: number | null): void {
    if (e.op === "&&" || e.op === "||") {
      const short = this.newLabel("sc");
      const end = this.newLabel("end");
      this.evalExpr(e.l);
      if (e.op === "&&") {
        this.emit(`JZ ${short}`, c); // left false → whole thing 0
        this.evalToBool(e.r, c);
        this.emit(`JUMP ${end}`, c);
        this.emit(`${short}: LOADC 0`, c);
      } else {
        const rhs = this.newLabel("rhs");
        this.emit(`JZ ${rhs}`, c); // left false → try right
        this.emit(`LOADC 1`, c);
        this.emit(`JUMP ${end}`, c);
        this.emit(`${rhs}:`, c);
        this.evalToBool(e.r, c);
      }
      this.emit(`${end}:`, c);
      return;
    }

    if (["==", "!=", "<", ">", "<=", ">="].includes(e.op)) {
      this.evalCompare(e, c);
      return;
    }

    const lt = this.typeOf(e.l);
    const rt = this.typeOf(e.r);
    const lPtr = lt.kind === "ptr" || lt.kind === "array";
    const rPtr = rt.kind === "ptr" || rt.kind === "array";
    const elemSize = (t: CType) =>
      t.kind === "ptr" ? sizeOf(t.to, this.structs) : t.kind === "array" ? sizeOf(t.of, this.structs) : 1;

    this.evalExpr(e.l);
    this.push(c);
    this.evalExpr(e.r);
    // pointer arithmetic: scale the integer side (§4 Unit 12)
    if ((e.op === "+" || e.op === "-") && lPtr && !rPtr) this.scaleA(elemSize(lt), c);
    this.emit(`STORE __t0`, c);
    this.pop(c);
    if ((e.op === "+" || e.op === "-") && rPtr && !lPtr) this.scaleA(elemSize(rt), c);

    switch (e.op) {
      case "+":
        this.emit(`ADD __t0`, c);
        return;
      case "-":
        this.emit(`SUB __t0`, c);
        return;
      case "*":
        this.needsMul = true;
        this.emit(`STORE __ma`, c);
        this.emit(`LOAD __t0`, c);
        this.emit(`STORE __mb`, c);
        this.emit(`CALL __mul`, c);
        return;
      case "/":
        this.needsDiv = true;
        this.emit(`STORE __ma`, c);
        this.emit(`LOAD __t0`, c);
        this.emit(`STORE __mb`, c);
        this.emit(`CALL __div`, c);
        return;
      case "%":
        this.needsMod = true;
        this.emit(`STORE __ma`, c);
        this.emit(`LOAD __t0`, c);
        this.emit(`STORE __mb`, c);
        this.emit(`CALL __mod`, c);
        return;
    }
    throw new MiniCError(e.line, `MiniC doesn't have the "${e.op}" operator.`);
  }

  /** Comparisons via subtraction + JZ/JNEG: exactly what Unit 10 teaches. */
  private evalCompare(e: Extract<Expr, { kind: "bin" }>, c: number | null): void {
    // Normalize: a>b ≡ b<a ; a>=b ≡ !(a<b) ; a<=b ≡ !(b<a)
    let { l, r } = e;
    let op = e.op;
    if (op === ">") {
      [l, r] = [r, l];
      op = "<";
    } else if (op === ">=") {
      op = "!<";
    } else if (op === "<=") {
      [l, r] = [r, l];
      op = "!<";
    }
    this.evalExpr(l);
    this.push(c);
    this.evalExpr(r);
    this.emit(`STORE __t0`, c);
    this.pop(c);
    this.emit(`SUB __t0`, c); // A = l - r
    const yes = this.newLabel("yes");
    const end = this.newLabel("end");
    if (op === "==") this.emit(`JZ ${yes}`, c);
    else if (op === "!=") {
      const no = this.newLabel("no");
      this.emit(`JZ ${no}`, c);
      this.emit(`LOADC 1`, c);
      this.emit(`JUMP ${end}`, c);
      this.emit(`${no}: LOADC 0`, c);
      this.emit(`${end}:`, c);
      return;
    } else if (op === "<") this.emit(`JNEG ${yes}`, c);
    else if (op === "!<") {
      // true when NOT negative
      const no = this.newLabel("no");
      this.emit(`JNEG ${no}`, c);
      this.emit(`LOADC 1`, c);
      this.emit(`JUMP ${end}`, c);
      this.emit(`${no}: LOADC 0`, c);
      this.emit(`${end}:`, c);
      return;
    }
    this.emit(`LOADC 0`, c);
    this.emit(`JUMP ${end}`, c);
    this.emit(`${yes}: LOADC 1`, c);
    this.emit(`${end}:`, c);
  }

  private evalToBool(e: Expr, c: number | null): void {
    this.evalExpr(e);
    const yes = this.newLabel("b1");
    const end = this.newLabel("bend");
    this.emit(`JZ ${yes}`, c);
    this.emit(`LOADC 1`, c);
    this.emit(`JUMP ${end}`, c);
    this.emit(`${yes}: LOADC 0`, c);
    this.emit(`${end}:`, c);
  }

  private evalAssign(e: Extract<Expr, { kind: "assign" }>, c: number | null): void {
    const t = e.target;
    // Simple variable targets store directly.
    if (t.kind === "var") {
      const local = this.locals.get(t.name);
      const param = this.params.get(t.name);
      if (local || param) {
        this.evalExpr(e.value);
        const off = local ? this.localOffset(local.slot) : this.paramOffset(param!.index);
        this.emit(`STORES ${off}`, c);
        return; // value stays in A
      }
      const g = this.globals.get(t.name);
      if (!g) {
        this.typeOf(t);
        return;
      }
      if (g.type.kind === "array" || g.type.kind === "struct") {
        throw new MiniCError(e.line, `You can't assign to a whole ${typeName(g.type)} at once — assign to its parts.`);
      }
      this.evalExpr(e.value);
      this.emit(this.widthOf(g.type) === 1 ? `STOREB ${g.label}` : `STORE ${g.label}`, c);
      return;
    }
    // Computed targets: address first, then value, then store-through.
    const tt = this.typeOf(t);
    this.evalAddr(t);
    this.push(c);
    this.evalExpr(e.value);
    this.emit(`STORE __s1`, c);
    this.pop(c); // A = address
    this.emit(`STORE __t0`, c);
    this.emit(`LOAD __s1`, c);
    this.emit(this.widthOf(tt) === 1 ? `STOREPB __t0` : `STOREP __t0`, c);
  }

  private evalCall(e: Extract<Expr, { kind: "call" }>, c: number | null): void {
    const f = this.funcs.get(e.name);
    if (!f) {
      this.typeOf(e); // throws with did-you-mean
      return;
    }
    if (e.args.length !== f.params.length) {
      throw new MiniCError(
        e.line,
        `${f.name} wants ${f.params.length} value${f.params.length === 1 ? "" : "s"}, but got ${e.args.length}.`
      );
    }
    for (const a of e.args) {
      this.evalExpr(a);
      this.push(c);
    }
    this.emit(`CALL ${e.name}`, c);
    if (e.args.length > 0) {
      this.emit(`STORE __rv`, c);
      for (const _ of e.args) this.pop(c);
      this.emit(`LOAD __rv`, c);
    }
  }

  // --------------------------------------------------------- statements

  compileStmts(stmts: Stmt[], fn: FuncDef): void {
    for (const s of stmts) this.compileStmt(s, fn);
  }

  compileStmt(s: Stmt, fn: FuncDef): void {
    const c = s.line - 1;
    switch (s.kind) {
      case "expr":
        this.evalExpr(s.e);
        return;
      case "decl": {
        if (s.init) {
          this.evalExpr(s.init);
          const slot = this.locals.get(s.name)!.slot;
          this.emit(`STORES ${this.localOffset(slot)}`, c);
        }
        return;
      }
      case "block":
        this.compileStmts(s.body, fn);
        return;
      case "if": {
        const elseL = this.newLabel("else");
        const endL = this.newLabel("fi");
        this.evalExpr(s.cond);
        this.emit(`JZ ${s.else_ ? elseL : endL}`, c);
        this.compileStmts(s.then, fn);
        if (s.else_) {
          this.emit(`JUMP ${endL}`, c);
          this.emit(`${elseL}:`, c);
          this.compileStmts(s.else_, fn);
        }
        this.emit(`${endL}:`, c);
        return;
      }
      case "while": {
        const top = this.newLabel("while");
        const end = this.newLabel("wend");
        this.emit(`${top}:`, c);
        this.evalExpr(s.cond);
        this.emit(`JZ ${end}`, c);
        this.compileStmts(s.body, fn);
        this.emit(`JUMP ${top}`, c);
        this.emit(`${end}:`, c);
        return;
      }
      case "for": {
        // `for` IS `while` with extra steps — the compiler view shows it (§4 U10).
        if (s.init) this.compileStmt(s.init, fn);
        const top = this.newLabel("for");
        const end = this.newLabel("fend");
        this.emit(`${top}:`, c);
        if (s.cond) {
          this.evalExpr(s.cond);
          this.emit(`JZ ${end}`, c);
        }
        this.compileStmts(s.body, fn);
        if (s.post) this.evalExpr(s.post);
        this.emit(`JUMP ${top}`, c);
        this.emit(`${end}:`, c);
        return;
      }
      case "return": {
        if (s.e) this.evalExpr(s.e);
        else this.emit(`LOADC 0`, c);
        this.emitEpilogue(c);
        return;
      }
    }
  }

  private emitEpilogue(c: number | null): void {
    if (this.nLocals > 0) {
      this.emit(`STORE __rv`, c);
      for (let i = 0; i < this.nLocals; i++) this.emit(`POP`, c);
      this.emit(`LOAD __rv`, c);
    }
    this.emit(`RET`, c);
  }

  // ---------------------------------------------------------- functions

  compileFunc(fn: FuncDef): void {
    this.locals = new Map();
    this.params = new Map();
    this.tempDepth = 0;
    this.nParams = fn.params.length;
    fn.params.forEach((p, i) => {
      if (this.params.has(p.name)) {
        throw new MiniCError(fn.line, `Two parameters of ${fn.name} are both called "${p.name}".`);
      }
      this.params.set(p.name, { index: i, type: p.type });
    });

    // Collect every local declared anywhere in the body: one flat frame.
    const collect = (stmts: Stmt[]): void => {
      for (const s of stmts) {
        if (s.kind === "decl") {
          if (this.locals.has(s.name) || this.params.has(s.name)) {
            throw new MiniCError(
              s.line,
              `"${s.name}" is declared twice in ${fn.name}. Each variable needs its own name here.`
            );
          }
          if (s.type.kind === "struct" || s.type.kind === "array") {
            throw new MiniCError(
              s.line,
              `In MiniC, ${s.type.kind}s live in global memory — declare "${s.name}" outside the function.`
            );
          }
          this.locals.set(s.name, { slot: this.locals.size, type: s.type });
        } else if (s.kind === "if") {
          collect(s.then);
          if (s.else_) collect(s.else_);
        } else if (s.kind === "while" || s.kind === "block") {
          collect(s.body);
        } else if (s.kind === "for") {
          if (s.init) collect([s.init]);
          collect(s.body);
        }
      }
    };
    collect(fn.body);
    this.nLocals = this.locals.size;

    this.emit(`${fn.name}:`, fn.line - 1);
    if (this.nLocals > 0) {
      this.emit(`LOADC 0`, fn.line - 1);
      for (let i = 0; i < this.nLocals; i++) this.emit(`PUSH`, fn.line - 1);
      this.tempDepth = 0; // locals are frame, not temporaries
    }
    this.compileStmts(fn.body, fn);
    // Fall-off-the-end return (returns 0).
    this.emit(`LOADC 0`, null);
    this.emitEpilogue(null);
  }

  // ------------------------------------------------------------ runtime

  private emitRuntime(): void {
    if (this.needsMul) {
      this.emit(`__mul:`); // A = __ma × __mb, by repeated addition
      this.emit(`LOADC 0`);
      this.emit(`STORE __mr`);
      this.emit(`__mulloop: LOAD __mb`);
      this.emit(`JZ __muldone`);
      this.emit(`MINUSONE __mb`);
      this.emit(`LOAD __mr`);
      this.emit(`ADD __ma`);
      this.emit(`STORE __mr`);
      this.emit(`JUMP __mulloop`);
      this.emit(`__muldone: LOAD __mr`);
      this.emit(`RET`);
    }
    if (this.needsDiv || this.needsMod) {
      // quotient in __mr, remainder left in __ma (values < 32768)
      this.emit(`__divbody:`);
      this.emit(`LOADC 0`);
      this.emit(`STORE __mr`);
      this.emit(`LOAD __mb`);
      this.emit(`JZ __divdone`); // ÷0 → quotient 0, remainder __ma
      this.emit(`__divloop: LOAD __ma`);
      this.emit(`SUB __mb`);
      this.emit(`JNEG __divdone`);
      this.emit(`STORE __ma`);
      this.emit(`PLUSONE __mr`);
      this.emit(`JUMP __divloop`);
      this.emit(`__divdone: RET`);
      if (this.needsDiv) {
        this.emit(`__div: CALL __divbody`);
        this.emit(`LOAD __mr`);
        this.emit(`RET`);
      }
      if (this.needsMod) {
        this.emit(`__mod: CALL __divbody`);
        this.emit(`LOAD __ma`);
        this.emit(`RET`);
      }
    }
  }

  private emitData(): void {
    // scratch words
    this.emit(`__t0: .word 0`);
    this.emit(`__s1: .word 0`);
    this.emit(`__rv: .word 0`);
    if (this.needsMul || this.needsDiv || this.needsMod) {
      this.emit(`__ma: .word 0`);
      this.emit(`__mb: .word 0`);
      this.emit(`__mr: .word 0`);
    }
    for (const v of [...this.consts].sort((a, b) => a - b)) {
      this.emit(`__k${v}: .word ${v}`);
    }
    for (const g of this.program.globals) {
      const line = g.line - 1;
      const size = sizeOf(g.type, this.structs);
      if (typeof g.init === "string") {
        if (g.type.kind === "ptr") {
          this.emit(`${g.name}: .word ${this.strLabel(g.init)}`, line);
        } else {
          throw new MiniCError(g.line, `"text" can only start a char* variable.`);
        }
      } else if (g.type.kind === "int" || g.type.kind === "ptr") {
        this.emit(`${g.name}: .word ${g.init ?? 0}`, line);
      } else if (g.type.kind === "char") {
        this.emit(`${g.name}: .byte ${(g.init ?? 0) & 0xff}`, line);
      } else {
        // arrays / structs: zeroed block
        const zeros: string[] = [];
        for (let i = 0; i < size; i++) zeros.push("0");
        this.emit(`${g.name}: .byte ${zeros.join(", ")}`, line);
      }
    }
    // String pool last: global initializers above may have added entries.
    for (const [value, label] of this.strings) {
      const bytes = [...value].map((ch) => ch.charCodeAt(0) & 0xff);
      bytes.push(0); // strings end at 0, not at the edge of anything (§10)
      this.emit(`${label}: .byte ${bytes.join(", ")}`);
    }
  }

  compile(): CompiledC {
    const main = this.funcs.get("main");
    if (!main) {
      throw new MiniCError(1, `Every MiniC program needs a function called main — that's where BitBot starts.`);
    }
    this.emit(`CALL main`, main.line - 1);
    this.emit(`HALT`, null);
    for (const f of this.program.funcs) this.compileFunc(f);
    this.emitRuntime();
    this.emitData();

    const lineMap: Record<number, number> = {};
    this.lines.forEach((l, i) => {
      if (l.cLine !== null) lineMap[i] = l.cLine;
    });
    return {
      asm: this.lines.map((l) => l.text).join("\n"),
      lineMap,
      program: this.program,
    };
  }
}

export function compileC(source: string): CompiledC {
  return new Compiler(parse(source)).compile();
}
