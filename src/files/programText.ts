import { OP_INFO } from "../vm/decode";

/**
 * Plain-text machine-code program format for playground saves (§8.3).
 * One instruction per line, decimal bytes, mnemonic in a `;` comment:
 *
 *     1 9    ; LOADC 9
 *     0 0    ; HALT
 *
 * Opens in any editor; comments are ignored on load. The assembly format
 * (.bb8.asm) arrives with the assembler in Phase 3.
 */
export function programToText(bytes: number[]): string {
  // Trim trailing zero pairs (HALT 0 is all zeros), then write one explicit
  // HALT line at the end so the program always reads — and reloads — complete.
  let end = bytes.length - (bytes.length % 2);
  while (end >= 2 && bytes[end - 1] === 0 && bytes[end - 2] === 0) end -= 2;
  const lines: string[] = ["; BitBot-8 machine code"];
  for (let i = 0; i < end; i += 2) {
    const op = bytes[i];
    const operand = bytes[i + 1] ?? 0;
    const info = OP_INFO[op];
    const comment = info
      ? info.hasOperand
        ? `${info.mnemonic} ${operand}`
        : info.mnemonic
      : "data?";
    lines.push(`${op} ${operand}    ; ${comment}`);
  }
  lines.push("0 0    ; HALT");
  return lines.join("\n") + "\n";
}

export function textToProgram(text: string): number[] {
  const bytes: number[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.split(";")[0].trim();
    if (!line) continue;
    for (const token of line.split(/\s+/)) {
      const v = parseInt(token, 10);
      if (Number.isNaN(v) || v < 0 || v > 255) {
        throw new Error(`I can't read "${token}" as a byte (0–255).`);
      }
      bytes.push(v);
    }
  }
  if (bytes.length > 128) {
    throw new Error("Programs load into boxes 0–127, so 128 bytes is the most that fits.");
  }
  return bytes;
}
