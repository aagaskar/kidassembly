import { SCREEN_START, SCREEN_W, SCREEN_H, VMState } from "../vm/types";
import { colorFor } from "./palette";

interface Props {
  state: VMState;
  /** When set, clicking a pixel paints it (playground). */
  onPaint?: (addr: number) => void;
}

/** The 8×8 memory-mapped screen: bytes 128–191 rendered as pixels. */
export function ScreenPanel({ state, onPaint }: Props) {
  return (
    <div className="screen">
      {Array.from({ length: SCREEN_W * SCREEN_H }, (_, i) => {
        const addr = SCREEN_START + i;
        return (
          <div
            key={addr}
            className={onPaint ? "pixel paintable" : "pixel"}
            style={{ background: colorFor(state.memory[addr]) }}
            title={`box ${addr}`}
            onClick={onPaint ? () => onPaint(addr) : undefined}
          />
        );
      })}
    </div>
  );
}
