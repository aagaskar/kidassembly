import { useMemo, useState } from "react";
import { assemble, AsmError } from "../asm/assemble";
import { MachineKind } from "../vm/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  machine?: MachineKind;
  /** Highlight this source line (synced stepping / current PC). */
  activeLine?: number;
  /** Extra errors to show (e.g. from a failed run). */
  rows?: number;
  readOnly?: boolean;
}

/**
 * The assembly editor: source on the left, assembled bytes per line on the
 * right, so "names are just numbers" never goes stale (§3.4). Errors are
 * shown inline under the editor in child-friendly words.
 */
export function AsmEditor({ value, onChange, machine = "bb8", activeLine, rows = 12, readOnly }: Props) {
  const assembled = useMemo(() => assemble(value, machine), [value, machine]);

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
          onChange={(e) => onChange(e.target.value)}
        />
        <pre className="asm-bytes" aria-hidden>
          {lines.map((_, i) => (
            <div key={i} className={i === activeLine ? "asm-active" : undefined}>
              {byteFor(i) || " "}
            </div>
          ))}
        </pre>
      </div>
      {assembled.errors.length > 0 && <AsmErrors errors={assembled.errors} />}
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
