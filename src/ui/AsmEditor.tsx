import { useMemo, useState } from "react";
import { assemble, AsmError } from "../asm/assemble";
import { MachineKind, MAX_OPCODE, MAX_OPCODE_BB16 } from "../vm/types";
import { OP_INFO } from "../vm/decode";

interface Props {
  value: string;
  onChange: (v: string) => void;
  machine?: MachineKind;
  /** Highlight this source line (synced stepping / current PC). */
  activeLine?: number;
  /** Extra errors to show (e.g. from a failed run). */
  rows?: number;
  readOnly?: boolean;
  /** Show the instruction reference card beside the editor (default true). */
  reference?: boolean;
}

/**
 * The assembly editor: source on the left, assembled bytes per line on the
 * right, so "names are just numbers" never goes stale (§3.4). Errors are
 * shown inline under the editor in child-friendly words.
 *
 * The line the caret is on is treated as "still being typed" and never
 * flagged — otherwise a half-typed instruction reads as "you're wrong" on
 * every keystroke. Errors surface as soon as you move off the line (a newline,
 * an arrow key, a click) or hit Run.
 */
export function AsmEditor({
  value,
  onChange,
  machine = "bb8",
  activeLine,
  rows = 12,
  readOnly,
  reference = true,
}: Props) {
  const assembled = useMemo(() => assemble(value, machine), [value, machine]);

  // 1-based source line the caret sits on; its errors are held back while
  // the child is still typing it. null = not focused, so show everything.
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const trackCaret = (el: HTMLTextAreaElement) => {
    const upto = el.value.slice(0, el.selectionStart);
    setEditingLine(upto.split("\n").length);
  };
  const shownErrors = assembled.errors.filter((e) => e.line !== editingLine);

  const lines = value.split("\n");
  const byteFor = (lineIdx: number): string => {
    if (!assembled.result) return "";
    const addr = assembled.result.lineToAddr[lineIdx];
    if (addr === undefined) return "";
    const count = Object.entries(assembled.result.addrToLine).filter(
      ([, l]) => l === lineIdx
    ).length;
    const bytes = assembled.result.bytes.slice(addr, addr + count);
    return `${addr}: ${bytes.join(" ")}`;
  };

  return (
    <div className="asm-editor">
      <div className="asm-pane">
        <textarea
          className="asm-text"
          value={value}
          spellCheck={false}
          readOnly={readOnly}
          rows={Math.max(rows, lines.length + 1)}
          onChange={(e) => {
            trackCaret(e.target);
            onChange(e.target.value);
          }}
          onSelect={(e) => trackCaret(e.currentTarget)}
          onBlur={() => setEditingLine(null)}
        />
        <pre className="asm-bytes" aria-hidden>
          {lines.map((_, i) => (
            <div key={i} className={i === activeLine ? "asm-active" : undefined}>
              {byteFor(i) || " "}
            </div>
          ))}
        </pre>
        {reference && <InstructionCard machine={machine} />}
      </div>
      {shownErrors.length > 0 && <AsmErrors errors={shownErrors} />}
    </div>
  );
}

/** Side card listing the instructions this machine understands. */
export function InstructionCard({ machine }: { machine: MachineKind }) {
  const maxOpcode = machine === "bb16" ? MAX_OPCODE_BB16 : MAX_OPCODE;
  const ops = Object.entries(OP_INFO)
    .filter(([opcode]) => Number(opcode) <= maxOpcode)
    .map(([, info]) => info);
  return (
    <div className="asm-ref">
      <h4>Instructions</h4>
      <p className="asm-ref-note">
        Type instructions in CAPITALS, like real assembly — <code>HALT</code>, not <code>halt</code>.
      </p>
      <dl>
        {ops.map((info) => (
          <div key={info.mnemonic} className="asm-ref-row">
            <dt>{info.usage}</dt>
            <dd>{info.summary}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AsmErrors({ errors }: { errors: AsmError[] }) {
  return (
    <div className="asm-errors">
      {errors.slice(0, 3).map((e, i) => (
        <div key={i} className="feedback-bad">
          Line {e.line}: {e.message}
        </div>
      ))}
    </div>
  );
}

/** Read-only assembly listing with a highlighted active line. */
export function AsmListing({ source, activeLine }: { source: string; activeLine?: number }) {
  return (
    <pre className="asm-listing">
      {source.split("\n").map((line, i) => (
        <div key={i} className={i === activeLine ? "asm-active" : undefined}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

/** Small local-state wrapper when the parent only needs the final text. */
export function useAsmDraft(initial: string) {
  return useState(initial);
}
