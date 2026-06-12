import { MachineKind, MACHINES, Op } from "../vm/types";

/**
 * The BitBot assembler (§3.4): line-oriented, labels for addresses, `.byte`
 * (and `.word` on bb16) for data, `;` comments. Error messages are written
 * for children — they name the line, say what the assembler was hoping to
 * see, and suggest near-miss spellings.
 */

export interface AsmError {
  line: number; // 1-based source line
  message: string;
}

export interface AsmResult {
  bytes: number[];
  /** label → address */
  symbols: Record<string, number>;
  /** source line (0-based) → address of the bytes it produced */
  lineToAddr: Record<number, number>;
  /** address → source line (0-based), for PC→line highlighting */
  addrToLine: Record<number, number>;
}

const MNEMONICS: Record<string, { op: Op; hasOperand: boolean; bb16Only?: boolean }> = {
  HALT: { op: Op.HALT, hasOperand: false },
  LOADC: { op: Op.LOADC, hasOperand: true },
  LOAD: { op: Op.LOAD, hasOperand: true },
  STORE: { op: Op.STORE, hasOperand: true },
  ADD: { op: Op.ADD, hasOperand: true },
  SUB: { op: Op.SUB, hasOperand: true },
  JUMP: { op: Op.JUMP, hasOperand: true },
  JZ: { op: Op.JZ, hasOperand: true },
  JNEG: { op: Op.JNEG, hasOperand: true },
  LOADP: { op: Op.LOADP, hasOperand: true },
  STOREP: { op: Op.STOREP, hasOperand: true },
  CALL: { op: Op.CALL, hasOperand: true },
  RET: { op: Op.RET, hasOperand: false },
  PUSH: { op: Op.PUSH, hasOperand: false },
  POP: { op: Op.POP, hasOperand: false },
  PLUSONE: { op: Op.PLUSONE, hasOperand: true },
  MINUSONE: { op: Op.MINUSONE, hasOperand: true },
  LOADB: { op: Op.LOADB, hasOperand: true, bb16Only: true },
  STOREB: { op: Op.STOREB, hasOperand: true, bb16Only: true },
  LOADS: { op: Op.LOADS, hasOperand: true, bb16Only: true },
  STORES: { op: Op.STORES, hasOperand: true, bb16Only: true },
};

/** Levenshtein distance, for "did you mean…" suggestions. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function nearest(word: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestDist = Math.max(1, Math.floor(word.length / 3));
  for (const c of candidates) {
    const d = editDistance(word.toUpperCase(), c.toUpperCase());
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

interface Token {
  label: string | null;
  mnemonic: string | null;
  args: string[];
  line: number; // 0-based
}

function tokenize(source: string): { tokens: Token[]; errors: AsmError[] } {
  const tokens: Token[] = [];
  const errors: AsmError[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let text = lines[i];
    const semi = text.indexOf(";");
    if (semi >= 0) text = text.slice(0, semi);
    text = text.trim();
    if (!text) continue;

    let label: string | null = null;
    const colon = text.indexOf(":");
    if (colon >= 0) {
      label = text.slice(0, colon).trim();
      text = text.slice(colon + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
        errors.push({
          line: i + 1,
          message: `"${label}" can't be a label name. Labels are a word made of letters, digits and _, starting with a letter.`,
        });
        continue;
      }
    }

    if (!text) {
      tokens.push({ label, mnemonic: null, args: [], line: i });
      continue;
    }
    const parts = text.split(/[\s,]+/).filter(Boolean);
    tokens.push({ label, mnemonic: parts[0], args: parts.slice(1), line: i });
  }
  return { tokens, errors };
}

function parseValue(
  raw: string,
  symbols: Record<string, number>,
  line: number,
  errors: AsmError[]
): number {
  // Character literal: 'A'
  const ch = raw.match(/^'(.)'$/);
  if (ch) return ch[1].charCodeAt(0);
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
    if (raw in symbols) return symbols[raw];
    const hint = nearest(raw, Object.keys(symbols));
    errors.push({
      line: line + 1,
      message:
        `I don't know a box called "${raw}"` +
        (hint ? ` — did you mean "${hint}"?` : ". Did you forget to make a label for it?"),
    });
    return 0;
  }
  errors.push({
    line: line + 1,
    message: `I can't read "${raw}" as a number or a label.`,
  });
  return 0;
}

export function assemble(source: string, machine: MachineKind = "bb8"): {
  result: AsmResult | null;
  errors: AsmError[];
} {
  const cfg = MACHINES[machine];
  const { tokens, errors } = tokenize(source);
  const wordDirBytes = cfg.wordBytes;

  // ---- pass 1: lay out addresses, collect labels
  const symbols: Record<string, number> = {};
  let addr = 0;
  interface Placed extends Token {
    addr: number;
  }
  const placed: Placed[] = [];
  for (const t of tokens) {
    if (t.label !== null) {
      if (t.label in symbols) {
        errors.push({
          line: t.line + 1,
          message: `The label "${t.label}" is used twice. Each label needs its own name.`,
        });
      }
      symbols[t.label] = addr;
    }
    if (t.mnemonic === null) continue;
    placed.push({ ...t, addr });

    const upper = t.mnemonic.toUpperCase();
    if (upper === ".BYTE") {
      addr += Math.max(1, t.args.length);
    } else if (upper === ".WORD") {
      addr += Math.max(1, t.args.length) * wordDirBytes;
    } else {
      addr += cfg.instrBytes;
    }
  }

  // ---- pass 2: emit bytes
  const bytes: number[] = [];
  const lineToAddr: Record<number, number> = {};
  const addrToLine: Record<number, number> = {};
  const emit = (line: number, at: number, ...vals: number[]) => {
    for (let i = 0; i < vals.length; i++) {
      bytes[at + i] = ((vals[i] % 256) + 256) % 256;
      addrToLine[at + i] = line;
    }
  };

  for (const t of placed) {
    lineToAddr[t.line] = t.addr;
    const upper = t.mnemonic!.toUpperCase();

    if (upper === ".BYTE") {
      if (t.args.length === 0) {
        errors.push({ line: t.line + 1, message: `.byte needs at least one number after it.` });
        emit(t.line, t.addr, 0);
        continue;
      }
      t.args.forEach((arg, i) =>
        emit(t.line, t.addr + i, parseValue(arg, symbols, t.line, errors))
      );
      continue;
    }

    if (upper === ".WORD") {
      if (machine !== "bb16") {
        errors.push({
          line: t.line + 1,
          message: `.word is a BitBot-16 thing — on BitBot-8 every box is one byte, so use .byte.`,
        });
        continue;
      }
      if (t.args.length === 0) {
        errors.push({ line: t.line + 1, message: `.word needs at least one number after it.` });
        emit(t.line, t.addr, 0, 0);
        continue;
      }
      t.args.forEach((arg, i) => {
        const v = parseValue(arg, symbols, t.line, errors);
        emit(t.line, t.addr + i * 2, v & 0xff, (v >> 8) & 0xff);
      });
      continue;
    }

    const info = MNEMONICS[upper];
    if (!info) {
      const hint = nearest(upper, Object.keys(MNEMONICS));
      errors.push({
        line: t.line + 1,
        message:
          `I don't know an instruction called "${t.mnemonic}"` +
          (hint ? ` — did you mean ${hint}?` : "."),
      });
      continue;
    }
    if (info.bb16Only && machine !== "bb16") {
      errors.push({
        line: t.line + 1,
        message: `${upper} only exists on BitBot-16 — the little BitBot-8 doesn't have it.`,
      });
      continue;
    }
    if (info.hasOperand && t.args.length === 0) {
      errors.push({
        line: t.line + 1,
        message: `${upper} needs something after it — a number or a label.`,
      });
      continue;
    }
    if (!info.hasOperand && t.args.length > 0) {
      errors.push({
        line: t.line + 1,
        message: `${upper} works alone — it doesn't take anything after it.`,
      });
      continue;
    }
    if (t.args.length > 1) {
      errors.push({
        line: t.line + 1,
        message: `${upper} takes just one thing after it, but I found ${t.args.length}.`,
      });
      continue;
    }

    let operand = info.hasOperand ? parseValue(t.args[0], symbols, t.line, errors) : 0;
    const operandMax = machine === "bb16" ? 65536 : 256;
    operand = ((operand % operandMax) + operandMax) % operandMax;
    if (machine === "bb16") {
      emit(t.line, t.addr, info.op, operand & 0xff, (operand >> 8) & 0xff);
    } else {
      emit(t.line, t.addr, info.op, operand);
    }
  }

  if (addr > cfg.memSize) {
    errors.push({
      line: tokens.length > 0 ? tokens[tokens.length - 1].line + 1 : 1,
      message: `This program needs ${addr} boxes, but the machine only has ${cfg.memSize}.`,
    });
  }

  if (errors.length > 0) return { result: null, errors };
  for (let i = 0; i < bytes.length; i++) bytes[i] ??= 0;
  return { result: { bytes, symbols, lineToAddr, addrToLine }, errors: [] };
}

/** Disassemble memory back to mnemonic lines (for the byte-next-to-source view). */
export function formatBytes(bytes: number[], at: number, count: number): string {
  return bytes.slice(at, at + count).join(" ");
}
