import { useState } from "react";
import {
  claimLegacyProgress,
  createProfile,
  deleteProfile,
  discardLegacyProgress,
  exportProfileFile,
  hasLegacyProgress,
  importAsNewProfile,
  importReplacingProfile,
  listProfiles,
  parseProfileFile,
  Profile,
  ProfileFile,
} from "../engine/profiles";
import { openTextFile, saveTextFile } from "../files/fileio";

const AVATARS = ["🤖", "🦊", "🐱", "🐶", "🦄", "🐸", "🐙", "🚀", "🐼", "🦖", "👾", "⭐"];

function AvatarPicker({ value, onChange }: { value: string; onChange: (a: string) => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {AVATARS.map((a) => (
        <button
          key={a}
          className={a === value ? "" : "secondary"}
          style={{ fontSize: "1.3em", padding: "4px 10px" }}
          onClick={() => onChange(a)}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function NameAvatarForm({
  prompt,
  submitLabel,
  onSubmit,
}: {
  prompt: string;
  submitLabel: string;
  onSubmit: (name: string, avatar: string) => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const ready = name.trim().length > 0;
  return (
    <div className="col">
      <p className="big">{prompt}</p>
      <div className="row" style={{ alignItems: "center" }}>
        <input
          type="text"
          placeholder="name"
          value={name}
          autoFocus
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ready && onSubmit(name, avatar)}
        />
        <button disabled={!ready} onClick={() => onSubmit(name, avatar)}>
          {submitLabel}
        </button>
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} />
    </div>
  );
}

export function ProfilePicker({
  onSelect,
}: {
  /** isNew: freshly created here (the app offers the placement probe). */
  onSelect: (p: Profile, isNew?: boolean) => void;
}) {
  // refresh is a cheap re-render trigger after store mutations
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [creating, setCreating] = useState(false);
  const [legacyPending, setLegacyPending] = useState(hasLegacyProgress());
  const [pendingImport, setPendingImport] = useState<ProfileFile | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const profiles = listProfiles();

  const doImport = async () => {
    const text = await openTextFile(".json,application/json");
    if (!text) return;
    try {
      const file = parseProfileFile(text);
      const collision = listProfiles().find((p) => p.name === file.profile.name);
      if (collision) {
        setPendingImport(file); // ask: replace or add as new
      } else {
        onSelect(importAsNewProfile(file));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "That file didn't look like a profile.");
    }
  };

  const exportOne = (profile: Profile) =>
    saveTextFile(
      `${profile.name.replace(/[^\w-]+/g, "_")}.bitbot-profile.json`,
      JSON.stringify(exportProfileFile(profile), null, 2)
    );

  return (
    <div>
      <h1>🤖 BitBot</h1>
      <p className="dim">Who's playing today?</p>
      <p className="dim" style={{ fontSize: "0.85em" }}>
        Profiles keep each person's progress separate on this device. They're a convenience, not a
        lock — there are no passwords.
      </p>

      {message && <div className="decode">{message}</div>}

      {legacyPending && (
        <div className="panel">
          <NameAvatarForm
            prompt="We found saved progress from before profiles existed! Whose is it? Give it a name to keep it."
            submitLabel="Keep it"
            onSubmit={(name, avatar) => {
              const p = claimLegacyProgress(name, avatar);
              setLegacyPending(false);
              onSelect(p);
            }}
          />
          <button
            className="secondary"
            style={{ marginTop: 8 }}
            onClick={() => {
              if (window.confirm("Really throw away the old progress? This can't be undone.")) {
                discardLegacyProgress();
                setLegacyPending(false);
                refresh();
              }
            }}
          >
            Throw it away instead
          </button>
        </div>
      )}

      {pendingImport && (
        <div className="panel">
          <p className="big">
            There's already a profile named <b>{pendingImport.profile.name}</b>. What should the
            imported one do?
          </p>
          <div className="row">
            <button
              className="danger"
              onClick={() => {
                const existing = listProfiles().find(
                  (p) => p.name === pendingImport.profile.name
                );
                if (existing) onSelect(importReplacingProfile(pendingImport, existing.id));
                setPendingImport(null);
              }}
            >
              Replace it
            </button>
            <button
              onClick={() => {
                onSelect(importAsNewProfile(pendingImport));
                setPendingImport(null);
              }}
            >
              Add as a new profile
            </button>
            <button className="secondary" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        {profiles.length === 0 && !legacyPending && (
          <p className="dim">No profiles yet — make one below!</p>
        )}
        {profiles.map((p) => (
          <div key={p.id} className="lesson-card">
            <div className="row" style={{ alignItems: "center" }}>
              <span style={{ fontSize: "1.6em" }}>{p.avatar}</span>
              <b className="big">{p.name}</b>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button onClick={() => onSelect(p)}>Play</button>
              <button className="secondary" title="save this profile to a file" onClick={() => exportOne(p)}>
                💾 Export
              </button>
              <button
                className="secondary"
                title="delete this profile"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${p.name} and all their progress? Export first if you want a backup!`
                    )
                  ) {
                    deleteProfile(p.id);
                    refresh();
                  }
                }}
              >
                🗑
              </button>
            </div>
          </div>
        ))}

        {creating ? (
          <div style={{ marginTop: 10 }}>
            <NameAvatarForm
              prompt="New profile — pick a name and a face."
              submitLabel="Create"
              onSubmit={(name, avatar) => onSelect(createProfile(name, avatar), true)}
            />
            <button className="secondary" style={{ marginTop: 8 }} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={() => setCreating(true)}>＋ New profile</button>
            <button className="secondary" onClick={doImport}>
              📂 Import profile file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
