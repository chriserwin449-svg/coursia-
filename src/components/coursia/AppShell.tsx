"use client";

import { useAppStore } from "@/lib/store";
import Sidebar from "@/components/coursia/Sidebar";
import LandingPage from "@/components/coursia/LandingPage";
import CreateCourse from "@/components/coursia/CreateCourse";
import Library from "@/components/coursia/Library";
import CourseViewer from "@/components/coursia/CourseViewer";
import Journey from "@/components/coursia/Journey";

export default function AppShell() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="min-h-screen bg-night">
      {view === "landing" ? (
        <LandingPage />
      ) : (
        <div className="min-h-screen">
          {view !== "viewer" && <Sidebar />}
          <main className={view !== "viewer" ? "md:ml-[72px] md:pl-0 pl-0 min-h-screen" : ""}>
            {view === "create" && <CreateCourse />}
            {view === "library" && <Library />}
            {view === "viewer" && <CourseViewer />}
            {view === "journey" && <Journey />}
          </main>
        </div>
      )}
    </div>
  );
}
