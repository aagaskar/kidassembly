import type { ScaffoldLevel, ScaffoldOverride } from "../engine/scaffolding";

interface Props {
  scaffoldId?: string;
  autoLevel: ScaffoldLevel;
  override: ScaffoldOverride;
  onOverride: (level: ScaffoldOverride) => void;
}

const OPTIONS: ScaffoldOverride[] = ["auto", "full", "faded", "hidden"];

/** Debug-only control for forcing scaffold visibility while testing lesson flows. */
export function ScaffoldDebugControls({ scaffoldId, autoLevel, override, onOverride }: Props) {
  if (!scaffoldId) return null;
  return (
    <div className="debug-scaffold panel">
      <div>
        <b>Debug scaffolding</b>: {scaffoldId} · auto is <b>{autoLevel}</b>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {OPTIONS.map((level) => (
          <button
            key={level}
            className={override === level ? "" : "secondary"}
            onClick={() => onOverride(level)}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}
