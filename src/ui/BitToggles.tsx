import { useState } from "react";
import type { ScaffoldLevel } from "../engine/scaffolding";

interface Props {
  bitCount: number;
  value: number;
  onChange: (v: number) => void;
  showWeights?: boolean;
}

/** A row of clickable switch-lamps; the leftmost bit is the highest weight. */
export function BitToggles({ bitCount, value, onChange, showWeights = true }: Props) {
  return (
    <div className="bitrow">
      {Array.from({ length: bitCount }, (_, i) => {
        const weight = 2 ** (bitCount - 1 - i);
        const on = (value & weight) !== 0;
        return (
          <div key={i} className="bit">
            <div
              className={on ? "lamp on" : "lamp"}
              role="switch"
              aria-checked={on}
              onClick={() => onChange(value ^ weight)}
            />
            {showWeights && <span className="weight">{weight}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function BinaryPlaceValueGuide({
  bitCount,
  value,
  level = "full",
}: {
  bitCount: number;
  value?: number;
  level?: Exclude<ScaffoldLevel, "hidden">;
}) {
  const hasValue = value !== undefined;
  const showDetails = level === "full";
  return (
    <div className={`binary-guide ${level === "faded" ? "faded" : ""}`} aria-label="Binary place value guide">
      <div className="dim">{level === "faded" ? "Place-value reminder" : "Place values: left to right"}</div>
      <div className="binary-guide-row">
        {Array.from({ length: bitCount }, (_, i) => {
          const weight = 2 ** (bitCount - 1 - i);
          const on = hasValue && (value & weight) !== 0;
          return (
            <div key={i} className={on ? "binary-guide-cell on" : "binary-guide-cell"}>
              <b>{weight}</b>
              {showDetails && hasValue && (
                <>
                  <span>{on ? "1 = ON" : "0 = OFF"}</span>
                  <span>{on ? `+${weight}` : "+0"}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {showDetails ? (
        <div className="dim">1 means the switch is ON. 0 means the switch is OFF.</div>
      ) : (
        <div className="dim">Try this one mostly from memory.</div>
      )}
    </div>
  );
}

/** Self-contained bits widget with its own state plus a live total readout. */
export function BitsExercise({
  bitCount,
  onValue,
}: {
  bitCount: number;
  onValue: (v: number) => void;
}) {
  const [value, setValue] = useState(0);
  return (
    <div className="col" style={{ alignItems: "center" }}>
      <BinaryPlaceValueGuide bitCount={bitCount} value={value} />
      <BitToggles
        bitCount={bitCount}
        value={value}
        onChange={(v) => {
          setValue(v);
          onValue(v);
        }}
      />
      <div className="big">
        adds up to: <b>{value}</b>
      </div>
    </div>
  );
}
