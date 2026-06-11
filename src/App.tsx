import { useState } from "react";
import { LESSONS, lessonById } from "./content/lessons";
import { completedLessons } from "./engine/progress";
import { Home } from "./ui/Home";
import { LessonPlayer } from "./ui/LessonPlayer";
import { Playground } from "./ui/Playground";

type Route = { page: "home" } | { page: "lesson"; id: string } | { page: "playground" };

export default function App() {
  const [route, setRoute] = useState<Route>({ page: "home" });
  const goHome = () => setRoute({ page: "home" });

  if (route.page === "lesson") {
    const lesson = lessonById(route.id);
    if (lesson) return <LessonPlayer lesson={lesson} onExit={goHome} />;
  }
  if (route.page === "playground") {
    return <Playground onExit={goHome} />;
  }
  return (
    <Home
      lessons={LESSONS}
      completed={completedLessons()}
      onOpenLesson={(id) => setRoute({ page: "lesson", id })}
      onOpenPlayground={() => setRoute({ page: "playground" })}
    />
  );
}
