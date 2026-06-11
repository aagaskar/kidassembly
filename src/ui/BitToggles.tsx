import { useState } from "react";

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
