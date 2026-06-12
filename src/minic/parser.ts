/**
 * MiniC (§7 Phase 4): a C subset — char/int, pointers, arrays, structs,
 * if/while/for, functions — parsed with recursive descent. The same AST
 * feeds the BitBot-16 compiler (Units 9–14) and the Phase-5 "real C"
 * interpreter. Errors are written for children, with line numbers.
 */

export class MiniCError extends Error {
  constructor(public line: number, message: string) {
    super(message);
  }
}

// ------------------------------------------------------------------ types

export type CType =
  | { kind: "int" }
  | { kind: "char" }
  | { kind: "void" }
  | { kind: "ptr"; to: CType }
  | { kind: "array"; of: CType; length: number }
  | { kind: "struct"; name: string };

export const INT: CType = { kind: "int" };
export const CHAR: CType = { kind: "char" };
export const VOID: CType = { kind: "void" };
export const ptr = (to: CType): CType => ({ kind: "ptr", to });

export function typeName(t: CType): string {
  switch (t.kind) {
    case "int":
    case "char":
    case "void":
      return t.kind;
    case "ptr":
      return `${typeName(t.to)}*`;
    case "array":
      return `${typeName(t.of)}[${t.length}]`;
    case "struct":
      return `struct ${t.name}`;
  }
}

// -------------------------------------------------------------------- AST

export interface StructDef {
  name: string;
  fields: { name: string; type: CType }[];
  line: number;
}

export type Expr =
  | { kind: "num"; value: number; line: number }
  | { kind: "str"; value: string; line: number }
  | { kind: "var"; name: string; line: number }
  | { kind: "un"; op: "-" | "!" | "*" | "&"; e: Expr; line: number }
  | { kind: "bin"; op: string; l: Expr; r: Expr; line: number }
  | { kind: "assign"; target: Expr; value: Expr; line: number }
  | { kind: "call"; name: string; args: Expr[]; line: number }
  | { kind: "index"; base: Expr; index: Expr; line: number }
  | { kind: "field"; base: Expr; name: string; arrow: boolean; line: number }
  | { kind: "cast"; type: CType; e: Expr; line: number };

export type Stmt =
  | { kind: "expr"; e: Expr; line: number }
  | { kind: "decl"; type: CType; name: string; init: Expr | null; line: number }
  | { kind: "if"; cond: Expr; then: Stmt[]; else_: Stmt[] | null; line: number }
  | { kind: "while"; cond: Expr; body: Stmt[]; line: number }
  | {
      kind: "for";
      init: Stmt | null;
      cond: Expr | null;
      post: Expr | null;
      body: Stmt[];
      line: number;
    }
  | { kind: "return"; e: Expr | null; line: number }
  | { kind: "block"; body: Stmt[]; line: number };

export interface FuncDef {
  name: string;
  ret: CType;
  params: { name: string; type: CType }[];
  body: Stmt[];
  line: number;
}

export interface GlobalDef {
  name: string;
  type: CType;
  /** Constant initializer (number) or string literal for char arrays/ptrs. */
  init: number | string | null;
  line: number;
}

export interface Program {
  structs: StructDef[];
  globals: GlobalDef[];
  funcs: FuncDef[];
}

// ------------------------------------------------------------------ lexer

type Tok =
  | { t: "num"; v: number; line: number }
  | { t: "str"; v: string; line: number }
  | { t: "id"; v: string; line: number }
  | { t: "punct"; v: string; line: number }
  | { t: "eof"; v: ""; line: number };

const KEYWORDS = new Set([
  "int", "char", "void", "if", "else", "while", "for", "return", "struct",
]);

const PUNCTS = [
  "==", "!=", "<=", ">=", "&&", "||", "->",
  "+", "-", "*", "/", "%", "=", "<", ">", "!", "&",
  "(", ")", "{", "}", "[", "]", ";", ",", ".",
];

function lex(source: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9xXa-fA-F]/.test(source[j])) j++;
      const raw = source.slice(i, j);
      const v = raw.toLowerCase().startsWith("0x") ? parseInt(raw, 16) : parseInt(raw, 10);
      if (Number.isNaN(v)) throw new MiniCError(line, `I can't read "${raw}" as a number.`);
      toks.push({ t: "num", v, line });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(source[j])) j++;
      toks.push({ t: "id", v: source.slice(i, j), line });
      i = j;
      continue;
    }
    if (c === "'") {
      const esc = source[i + 1] === "\\";
      const ch = esc ? { n: "\n", t: "\t", "0": "\0", "'": "'", "\\": "\\" }[source[i + 2]] : source[i + 1];
      const close = i + (esc ? 3 : 2);
      if (ch === undefined || source[close] !== "'") {
        throw new MiniCError(line, `A character needs quotes around exactly one letter, like 'A'.`);
      }
      toks.push({ t: "num", v: ch.charCodeAt(0), line });
      i = close + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < n && source[j] !== '"') {
        if (source[j] === "\\") {
          const m = { n: "\n", t: "\t", "0": "\0", '"': '"', "\\": "\\" }[source[j + 1]];
          if (m === undefined) throw new MiniCError(line, `I don't know the escape \\${source[j + 1]}.`);
          s += m;
          j += 2;
        } else {
          s += source[j];
          j++;
        }
      }
      if (j >= n) throw new MiniCError(line, `This string never closes — it needs a " at the end.`);
      toks.push({ t: "str", v: s, line });
      i = j + 1;
      continue;
    }
    const p = PUNCTS.find((p) => source.startsWith(p, i));
    if (p) {
      toks.push({ t: "punct", v: p, line });
      i += p.length;
      continue;
    }
    throw new MiniCError(line, `I don't know what "${c}" means here.`);
  }
  toks.push({ t: "eof", v: "", line });
  return toks;
}

// ----------------------------------------------------------------- parser

class Parser {
  private pos = 0;
  structs = new Map<string, StructDef>();

  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.pos];
  }
  private next(): Tok {
    return this.toks[this.pos++];
  }
  private at(v: string): boolean {
    const t = this.peek();
    return (t.t === "punct" || t.t === "id") && t.v === v;
  }
  private eat(v: string): boolean {
    if (this.at(v)) {
      this.pos++;
      return true;
    }
    return false;
  }
  private expect(v: string, what?: string): Tok {
    const t = this.peek();
    if ((t.t === "punct" || t.t === "id") && t.v === v) return this.next();
    throw new MiniCError(
      t.line,
      what ?? `I was expecting "${v}" here, but found "${t.v || "the end of the program"}".`
    );
  }
  private ident(what: string): { name: string; line: number } {
    const t = this.peek();
    if (t.t !== "id" || KEYWORDS.has(t.v)) {
      throw new MiniCError(t.line, `I was expecting ${what}, but found "${t.v || "the end"}".`);
    }
    this.next();
    return { name: t.v, line: t.line };
  }

  // ---- types

  private atType(): boolean {
    const t = this.peek();
    return t.t === "id" && (t.v === "int" || t.v === "char" || t.v === "void" || t.v === "struct");
  }

  private parseBaseType(): CType {
    const t = this.next();
    if (t.t !== "id") throw new MiniCError(t.line, `I was expecting a type here.`);
    if (t.v === "int") return INT;
    if (t.v === "char") return CHAR;
    if (t.v === "void") return VOID;
    if (t.v === "struct") {
      const { name } = this.ident("the struct's name");
      return { kind: "struct", name };
    }
    throw new MiniCError(t.line, `"${t.v}" isn't a type MiniC knows (try int or char).`);
  }

  private parseType(): CType {
    let t = this.parseBaseType();
    while (this.eat("*")) t = ptr(t);
    return t;
  }

  // ---- program

  parseProgram(): Program {
    const program: Program = { structs: [], globals: [], funcs: [] };
    while (this.peek().t !== "eof") {
      if (this.at("struct") && this.toks[this.pos + 2]?.v === "{") {
        program.structs.push(this.parseStructDef());
        continue;
      }
      const line = this.peek().line;
      const type = this.parseType();
      const { name } = this.ident("a name");
      if (this.at("(")) {
        program.funcs.push(this.parseFunc(type, name, line));
      } else {
        program.globals.push(...this.parseGlobal(type, name, line));
      }
    }
    return program;
  }

  private parseStructDef(): StructDef {
    const line = this.expect("struct").line;
    const { name } = this.ident("the struct's name");
    this.expect("{");
    const fields: StructDef["fields"] = [];
    while (!this.eat("}")) {
      const ft = this.parseType();
      const f = this.ident("a field name");
      let t = ft;
      if (this.eat("[")) {
        const len = this.peek();
        if (len.t !== "num") throw new MiniCError(len.line, `Array sizes must be plain numbers.`);
        this.next();
        this.expect("]");
        t = { kind: "array", of: ft, length: len.v };
      }
      fields.push({ name: f.name, type: t });
      this.expect(";");
    }
    this.eat(";");
    const def = { name, fields, line };
    this.structs.set(name, def);
    return def;
  }

  private parseGlobal(type: CType, name: string, line: number): GlobalDef[] {
    const out: GlobalDef[] = [];
    let first = true;
    let curName = name;
    for (;;) {
      let t = type;
      if (!first) {
        while (this.eat("*")) t = ptr(t);
        curName = this.ident("a name").name;
      }
      if (this.eat("[")) {
        const len = this.peek();
        if (len.t !== "num") throw new MiniCError(len.line, `Array sizes must be plain numbers.`);
        this.next();
        this.expect("]");
        t = { kind: "array", of: t, length: len.v };
      }
      let init: number | string | null = null;
      if (this.eat("=")) {
        const v = this.peek();
        if (v.t === "num") {
          this.next();
          init = v.v;
        } else if (v.t === "str") {
          this.next();
          init = v.v;
        } else if (v.t === "punct" && v.v === "-") {
          this.next();
          const num = this.peek();
          if (num.t !== "num") throw new MiniCError(num.line, `Globals can only start with a plain number.`);
          this.next();
          init = -num.v;
        } else if (v.t === "punct" && v.v === "(") {
          // (char*)2048 — the framebuffer idiom. Allow cast-of-constant.
          this.next();
          this.parseType();
          this.expect(")");
          const num = this.peek();
          if (num.t !== "num") throw new MiniCError(num.line, `After a cast, globals need a plain number.`);
          this.next();
          init = num.v;
        } else {
          throw new MiniCError(v.line, `Globals can only start as a plain number or "text".`);
        }
      }
      out.push({ name: curName, type: t, init, line });
      first = false;
      if (!this.eat(",")) break;
    }
    this.expect(";");
    return out;
  }

  private parseFunc(ret: CType, name: string, line: number): FuncDef {
    this.expect("(");
    const params: FuncDef["params"] = [];
    if (!this.eat(")")) {
      do {
        if (this.at("void") && this.toks[this.pos + 1]?.v === ")") {
          this.next();
          break;
        }
        const t = this.parseType();
        const p = this.ident("a parameter name");
        params.push({ name: p.name, type: t });
      } while (this.eat(","));
      this.expect(")");
    }
    this.expect("{");
    const body = this.parseBlockBody();
    return { name, ret, params, body, line };
  }

  // ---- statements

  private parseBlockBody(): Stmt[] {
    const body: Stmt[] = [];
    while (!this.eat("}")) {
      if (this.peek().t === "eof") {
        throw new MiniCError(this.peek().line, `A { never got its closing }.`);
      }
      body.push(this.parseStmt());
    }
    return body;
  }

  private parseStmt(): Stmt {
    const t = this.peek();
    const line = t.line;

    if (this.eat("{")) return { kind: "block", body: this.parseBlockBody(), line };

    if (this.atType()) {
      const type = this.parseType();
      const { name } = this.ident("a variable name");
      if (this.at("[")) {
        throw new MiniCError(
          line,
          `In MiniC, arrays live in global memory — declare "${name}[...]" outside the function.`
        );
      }
      let init: Expr | null = null;
      if (this.eat("=")) init = this.parseExpr();
      this.expect(";");
      return { kind: "decl", type, name, init, line };
    }

    if (this.eat("if")) {
      this.expect("(");
      const cond = this.parseExpr();
      this.expect(")");
      const then = this.parseStmtAsBlock();
      let else_: Stmt[] | null = null;
      if (this.eat("else")) else_ = this.parseStmtAsBlock();
      return { kind: "if", cond, then, else_, line };
    }

    if (this.eat("while")) {
      this.expect("(");
      const cond = this.parseExpr();
      this.expect(")");
      return { kind: "while", cond, body: this.parseStmtAsBlock(), line };
    }

    if (this.eat("for")) {
      this.expect("(");
      let init: Stmt | null = null;
      if (!this.eat(";")) {
        if (this.atType()) {
          const type = this.parseType();
          const { name } = this.ident("a variable name");
          let i: Expr | null = null;
          if (this.eat("=")) i = this.parseExpr();
          init = { kind: "decl", type, name, init: i, line };
        } else {
          init = { kind: "expr", e: this.parseExpr(), line };
        }
        this.expect(";");
      }
      let cond: Expr | null = null;
      if (!this.eat(";")) {
        cond = this.parseExpr();
        this.expect(";");
      }
      let post: Expr | null = null;
      if (!this.at(")")) post = this.parseExpr();
      this.expect(")");
      return { kind: "for", init, cond, post, body: this.parseStmtAsBlock(), line };
    }

    if (this.eat("return")) {
      let e: Expr | null = null;
      if (!this.at(";")) e = this.parseExpr();
      this.expect(";");
      return { kind: "return", e, line };
    }

    const e = this.parseExpr();
    this.expect(";", `This line needs a ; at the end.`);
    return { kind: "expr", e, line };
  }

  private parseStmtAsBlock(): Stmt[] {
    const s = this.parseStmt();
    return s.kind === "block" ? s.body : [s];
  }

  // ---- expressions (precedence climbing)

  parseExpr(): Expr {
    return this.parseAssign();
  }

  private parseAssign(): Expr {
    const target = this.parseOr();
    if (this.eat("=")) {
      const line = this.peek().line;
      const value = this.parseAssign();
      if (!["var", "un", "index", "field"].includes(target.kind) ||
          (target.kind === "un" && target.op !== "*")) {
        throw new MiniCError(
          line,
          `The left side of = must be a place to put things (a variable, *pointer, array[i], or field).`
        );
      }
      return { kind: "assign", target, value, line };
    }
    return target;
  }

  private parseOr(): Expr {
    let l = this.parseAnd();
    while (this.at("||")) {
      const line = this.next().line;
      l = { kind: "bin", op: "||", l, r: this.parseAnd(), line };
    }
    return l;
  }

  private parseAnd(): Expr {
    let l = this.parseCmp();
    while (this.at("&&")) {
      const line = this.next().line;
      l = { kind: "bin", op: "&&", l, r: this.parseCmp(), line };
    }
    return l;
  }

  private parseCmp(): Expr {
    let l = this.parseAdd();
    for (;;) {
      const op = ["==", "!=", "<=", ">=", "<", ">"].find((o) => this.at(o));
      if (!op) return l;
      const line = this.next().line;
      l = { kind: "bin", op, l, r: this.parseAdd(), line };
    }
  }

  private parseAdd(): Expr {
    let l = this.parseMul();
    for (;;) {
      if (this.at("+") || this.at("-")) {
        const t = this.next();
        l = { kind: "bin", op: t.v, l, r: this.parseMul(), line: t.line };
      } else return l;
    }
  }

  private parseMul(): Expr {
    let l = this.parseUnary();
    for (;;) {
      if (this.at("*") || this.at("/") || this.at("%")) {
        const t = this.next();
        l = { kind: "bin", op: t.v, l, r: this.parseUnary(), line: t.line };
      } else return l;
    }
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (this.at("-") || this.at("!") || this.at("*") || this.at("&")) {
      this.next();
      return { kind: "un", op: t.v as "-" | "!" | "*" | "&", e: this.parseUnary(), line: t.line };
    }
    // cast: ( type ) unary
    if (this.at("(") && this.toks[this.pos + 1]?.t === "id" &&
        ["int", "char", "void", "struct"].includes(this.toks[this.pos + 1].v as string)) {
      this.next();
      const type = this.parseType();
      this.expect(")");
      return { kind: "cast", type, e: this.parseUnary(), line: t.line };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      if (this.eat("[")) {
        const index = this.parseExpr();
        const line = this.expect("]").line;
        e = { kind: "index", base: e, index, line };
      } else if (this.eat(".")) {
        const f = this.ident("a field name");
        e = { kind: "field", base: e, name: f.name, arrow: false, line: f.line };
      } else if (this.eat("->")) {
        const f = this.ident("a field name");
        e = { kind: "field", base: e, name: f.name, arrow: true, line: f.line };
      } else return e;
    }
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.t === "num") {
      this.next();
      return { kind: "num", value: t.v, line: t.line };
    }
    if (t.t === "str") {
      this.next();
      return { kind: "str", value: t.v, line: t.line };
    }
    if (this.eat("(")) {
      const e = this.parseExpr();
      this.expect(")");
      return e;
    }
    if (t.t === "id" && !KEYWORDS.has(t.v)) {
      this.next();
      if (this.eat("(")) {
        const args: Expr[] = [];
        if (!this.eat(")")) {
          do {
            args.push(this.parseExpr());
          } while (this.eat(","));
          this.expect(")");
        }
        return { kind: "call", name: t.v, args, line: t.line };
      }
      return { kind: "var", name: t.v, line: t.line };
    }
    throw new MiniCError(
      t.line,
      `I was expecting a value here, but found "${t.v || "the end of the program"}".`
    );
  }
}

export function parse(source: string): Program {
  return new Parser(lex(source)).parseProgram();
}
