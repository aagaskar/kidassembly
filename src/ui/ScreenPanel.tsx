import { configOf, VMState } from "../vm/types";
import { colorFor } from "./palette";

interface Props {
  state: VMState;
  /** When set, clicking a pixel paints it (playground). */
  onPaint?: (addr: number) => void;
}

/**
 * The memory-mapped screen: 8×8 (bb8, boxes 128–191) or 32×32 (bb16,
 * boxes 2048–3071) rendered as pixels.
 */
export function ScreenPanel({ state, onPaint }: Props) {
  const cfg = configOf(state);
  const px = cfg.screenW <= 8 ? 24 : 7;
  return (
    <div
      className="screen"
      style={{ gridTemplateColumns: `repeat(${cfg.screenW}, ${px}px)` }}
    >
      {Array.from({ length: cfg.screenW * cfg.screenH }, (_, i) => {
        const addr = cfg.screenStart + i;
        return (
          <div
            key={addr}
            className={onPaint ? "pixel paintable" : "pixel"}
            style={{ background: colorFor(state.memory[addr]), width: px, height: px }}
            title={`box ${addr}`}
            onClick={onPaint ? () => onPaint(addr) : undefined}
          />
        );
      })}
    </div>
  );
}
