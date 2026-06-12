import { useMemo, useState } from "react";
import { Profile, exportProfileFile, getSettings, saveSettings } from "../engine/profiles";
import { SKILLS } from "../content/skills";
import { dueSkills, getTelemetry, getXP, loadSkillStates, masteryOf } from "../engine/mastery";
import { daysOverdue, FsrsState } from "../engine/fsrs";
import { saveTextFile } from "../files/fileio";

interface Props {
  profile: Profile;
  onExit: () => void;
}

/**
 * Parent dashboard (§8.4): read-only, local-only, computed on demand from
 * the profile's own state and telemetry — never cached, nothing collected,
 * nothing leaves the device. Behind a lightweight grown-up gate.
 */
export function Dashboard({ profile, onExit }: Props) {
  // Friction against bored children, explicitly NOT security — do not
  // harden this; the design doc says so out loud (§8.4).
  const [gate, setGate] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="panel" style={{ maxWidth: 460, margin: "40px auto" }}>
        <h2>Grown-ups only</h2>
        <p className="dim">To peek at progress, type the answer: what is 7 × 8?</p>
        <div className="row" style={{ alignItems: "center" }}>
          <input
            type="number"
            value={gate}
            autoFocus
            onChange={(e) => setGate(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && gate === "56" && setOpen(true)}
          />
          <button onClick={() => gate === "56" && setOpen(true)}>Enter</button>
          <button className="secondary" onClick={onExit}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return <DashboardBody profile={profile} onExit={onExit} />;
}

/** Parent-facing override of the progressive playground unlock (§8.1). */
function UnlockToggle({ profileId }: { profileId: string }) {
  const [unlockAll, setUnlockAll] = useState(Boolean(getSettings(profileId).unlockAll));
  return (
    <label>
      <input
        type="checkbox"
        checked={unlockAll}
        onChange={(e) => {
          setUnlockAll(e.target.checked);
          saveSettings(profileId, { ...getSettings(profileId), unlockAll: e.target.checked });
        }}
      />{" "}
      Unlock every playground tool now (normally they appear as the curriculum introduces them)
    </label>
  );
}

function DashboardBody({ profile, onExit }: Props) {
  const now = new Date();
  const data = useMemo(() => {
    const states = loadSkillStates(profile.id);
    const telemetry = getTelemetry(profile.id);

    let mastered = 0;
    let inProgress = 0;
    let lockedCount = 0;
    const struggling: string[] = [];
    let overdue = 0;
    for (const skill of SKILLS) {
      const m = masteryOf(skill, states);
      if (m === "mastered") mastered++;
      else if (m === "locked") lockedCount++;
      else inProgress++;
      if (m === "relearning") struggling.push(skill.title);
      const st = states.get(skill.id);
      if (st?.fsrs && daysOverdue(st.fsrs as FsrsState, now) > 1) overdue++;
    }

    const DAY = 24 * 60 * 60 * 1000;
    const within = (days: number) =>
      telemetry.filter((a) => now.getTime() - new Date(a.at).getTime() < days * DAY);
    const last7 = within(7);
    const last30 = within(30);
    const accuracy7 =
      last7.length > 0 ? Math.round((100 * last7.filter((a) => a.correct).length) / last7.length) : null;

    // recent repeated failures (struggle list beyond relearning)
    const failCounts = new Map<string, number>();
    for (const a of last7) {
      if (!a.correct) failCounts.set(a.skillId, (failCounts.get(a.skillId) ?? 0) + 1);
    }
    for (const [skillId, fails] of failCounts) {
      if (fails >= 2) {
        const title = SKILLS.find((s) => s.id === skillId)?.title;
        if (title && !struggling.includes(title)) struggling.push(title);
      }
    }

    const due = dueSkills(profile.id, SKILLS, now).length;
    const unitsDone = new Set(
      SKILLS.filter((s) => masteryOf(s, states) === "mastered").map((s) => s.unit)
    );
    const currentUnit = Math.min(...SKILLS.filter((s) => masteryOf(s, states) !== "mastered").map((s) => s.unit), 15);

    return {
      mastered,
      inProgress,
      lockedCount,
      struggling,
      overdue,
      due,
      last7: last7.length,
      last30: last30.length,
      accuracy7,
      xp: getXP(profile.id),
      bitbot16: unitsDone.has(8),
      currentUnit,
    };
  }, [profile.id, now]);

  const exportProfile = () =>
    saveTextFile(
      `${profile.name.toLowerCase().replace(/\s+/g, "-")}-bitbot-profile.json`,
      JSON.stringify(exportProfileFile(profile), null, 2)
    );

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>
          📊 {profile.avatar} {profile.name}
        </h2>
        <button className="secondary" onClick={onExit}>
          ✕ Back
        </button>
      </div>
      <p className="dim">
        Everything here is computed on this device, from this profile's local data. Nothing is
        collected; nothing leaves the device.
      </p>

      <div className="panel">
        <h3>Where they are</h3>
        <p>
          Working in <b>Unit {data.currentUnit}</b>. Skills: <b>{data.mastered}</b> mastered,{" "}
          <b>{data.inProgress}</b> available, <b>{data.lockedCount}</b> still locked.
          {data.bitbot16 && " 🎉 BitBot-16 unlocked!"}
        </p>
        <p className="dim">⭐ {data.xp} XP — earned only for demonstrated mastery and finished reviews.</p>
      </div>

      <div className="panel">
        <h3>Activity</h3>
        <p>
          Items answered: <b>{data.last7}</b> in the last 7 days, <b>{data.last30}</b> in the last
          30. {data.accuracy7 !== null && <>First-try accuracy this week: <b>{data.accuracy7}%</b>.</>}
        </p>
      </div>

      <div className="panel">
        <h3>Review health</h3>
        <p>
          <b>{data.due}</b> review{data.due === 1 ? "" : "s"} due now; <b>{data.overdue}</b> more
          than a day overdue.
        </p>
        {data.overdue > 3 && (
          <p className="feedback-bad">
            A growing overdue pile is the early sign that practice has lapsed.
          </p>
        )}
        <p className="dim">A few short sessions a week keeps reviews healthy.</p>
      </div>

      {data.struggling.length > 0 && (
        <div className="panel">
          <h3>Worth a look</h3>
          <p className="dim">Skills currently being relearned or missed repeatedly this week:</p>
          <ul>
            {data.struggling.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <h3>Settings</h3>
        <UnlockToggle profileId={profile.id} />
      </div>

      <div className="panel">
        <h3>Backup</h3>
        <p className="dim">
          One file holds everything: progress, schedules, settings. Move it to another device and
          import it there.
        </p>
        <button onClick={exportProfile}>💾 Export this profile</button>
      </div>
    </div>
  );
}
