import { useState } from "react";
import { LESSONS, lessonById } from "./content/lessons";
import { SKILLS } from "./content/skills";
import {
  completedLessons,
  lastActiveProfile,
  Profile,
  setLastActive,
} from "./engine/profiles";
import { loadSkillStates, seedMastered } from "./engine/mastery";
import { Home } from "./ui/Home";
import { LessonPlayer } from "./ui/LessonPlayer";
import { Playground } from "./ui/Playground";
import { ProfilePicker } from "./ui/ProfilePicker";
import { ReviewSession } from "./ui/ReviewSession";
import { Dashboard } from "./ui/Dashboard";
import { Placement } from "./ui/Placement";

type Route =
  | { page: "home" }
  | { page: "lesson"; id: string }
  | { page: "playground" }
  | { page: "review" }
  | { page: "dashboard" }
  | { page: "placement" };

/**
 * Lessons completed before the Phase-2 engine existed (or imported from a
 * v1 profile file) have no skill states — seed them as mastered so the
 * graph and scheduler pick them up.
 */
function syncLessonsToSkills(profileId: string): void {
  const completed = completedLessons(profileId);
  if (completed.size === 0) return;
  const states = loadSkillStates(profileId);
  const missing = [...completed].filter(
    (id) => !states.has(id) && SKILLS.some((s) => s.id === id)
  );
  if (missing.length > 0) seedMastered(profileId, missing);
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => {
    const p = lastActiveProfile();
    if (p) syncLessonsToSkills(p.id);
    return p;
  });
  const [route, setRoute] = useState<Route>({ page: "home" });
  const goHome = () => setRoute({ page: "home" });

  if (!profile) {
    return (
      <ProfilePicker
        onSelect={(p, isNew) => {
          setLastActive(p.id);
          syncLessonsToSkills(p.id);
          setProfile(p);
          setRoute({ page: isNew ? "placement" : "home" });
        }}
      />
    );
  }

  if (route.page === "placement") {
    return <Placement profileId={profile.id} onFinish={goHome} />;
  }
  if (route.page === "lesson") {
    const lesson = lessonById(route.id);
    if (lesson) return <LessonPlayer lesson={lesson} profileId={profile.id} onExit={goHome} />;
  }
  if (route.page === "playground") {
    return <Playground profileId={profile.id} onExit={goHome} />;
  }
  if (route.page === "review") {
    return <ReviewSession profileId={profile.id} onExit={goHome} />;
  }
  if (route.page === "dashboard") {
    return <Dashboard profile={profile} onExit={goHome} />;
  }
  return (
    <Home
      lessons={LESSONS}
      completed={completedLessons(profile.id)}
      profile={profile}
      onSwitchProfile={() => setProfile(null)}
      onOpenLesson={(id) => setRoute({ page: "lesson", id })}
      onOpenPlayground={() => setRoute({ page: "playground" })}
      onOpenReview={() => setRoute({ page: "review" })}
      onOpenDashboard={() => setRoute({ page: "dashboard" })}
    />
  );
}
