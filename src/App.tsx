import { useState } from "react";
import { LESSONS, lessonById } from "./content/lessons";
import {
  completedLessons,
  lastActiveProfile,
  Profile,
  setLastActive,
} from "./engine/profiles";
import { Home } from "./ui/Home";
import { LessonPlayer } from "./ui/LessonPlayer";
import { Playground } from "./ui/Playground";
import { ProfilePicker } from "./ui/ProfilePicker";

type Route = { page: "home" } | { page: "lesson"; id: string } | { page: "playground" };

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(lastActiveProfile);
  const [route, setRoute] = useState<Route>({ page: "home" });
  const goHome = () => setRoute({ page: "home" });

  if (!profile) {
    return (
      <ProfilePicker
        onSelect={(p) => {
          setLastActive(p.id);
          setProfile(p);
          setRoute({ page: "home" });
        }}
      />
    );
  }

  if (route.page === "lesson") {
    const lesson = lessonById(route.id);
    if (lesson) return <LessonPlayer lesson={lesson} profileId={profile.id} onExit={goHome} />;
  }
  if (route.page === "playground") {
    return <Playground onExit={goHome} />;
  }
  return (
    <Home
      lessons={LESSONS}
      completed={completedLessons(profile.id)}
      profile={profile}
      onSwitchProfile={() => setProfile(null)}
      onOpenLesson={(id) => setRoute({ page: "lesson", id })}
      onOpenPlayground={() => setRoute({ page: "playground" })}
    />
  );
}
