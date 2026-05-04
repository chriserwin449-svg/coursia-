"use client";

import { useAppStore } from "@/lib/store";
import Sidebar from "@/components/coursia/Sidebar";
import LandingPage from "@/components/coursia/LandingPage";
import CreateCourse from "@/components/coursia/CreateCourse";
import Library from "@/components/coursia/Library";
import CourseViewer from "@/components/coursia/CourseViewer";
import Journey from "@/components/coursia/Journey";
import OffersPage from "@/components/coursia/OffersPage";
import TopBar from "@/components/coursia/TopBar";

export default function AppShell() {
  const view = useAppStore((s) => s.view);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-night">
      {view === "landing" ? (
        <LandingPage />
      ) : (
        <div className="min-h-screen">
          {view !== "viewer" && <Sidebar />}
          {view !== "viewer" && <TopBar />}
          <main
            className={`min-h-screen transition-all duration-300 ease-in-out ${
              view !== "viewer"
                ? collapsed
                  ? "ml-[72px]"
                  : "ml-[72px] md:ml-64"
                : ""
            }`}
          >
            {view === "create" && <CreateCourse />}
            {view === "library" && <Library />}
            {view === "viewer" && <CourseViewer />}
            {view === "journey" && <Journey />}
            {view === "offers" && <OffersPage />}
          </main>
        </div>
      )}
    </div>
  );
}
