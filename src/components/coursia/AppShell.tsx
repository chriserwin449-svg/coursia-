"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/hooks/useSession";
import Sidebar from "@/components/coursia/Sidebar";
import LandingPage from "@/components/coursia/LandingPage";
import AuthPage from "@/components/coursia/AuthPage";
import CreateCourse from "@/components/coursia/CreateCourse";
import Library from "@/components/coursia/Library";
import CourseViewer from "@/components/coursia/CourseViewer";
import Journey from "@/components/coursia/Journey";
import OffersPage from "@/components/coursia/OffersPage";
import TopBar from "@/components/coursia/TopBar";

export default function AppShell() {
  const view = useAppStore((s) => s.view);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const user = useAppStore((s) => s.user);
  const setAuthToken = useAppStore((s) => s.setAuthToken);

  // Restore session (validates token with server and restores user data)
  useSession();

  // Restore auth token from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("coursia-auth-token");
      if (savedToken) {
        setAuthToken(savedToken);
      }
    }
  }, [setAuthToken]);

  return (
    <div className="min-h-screen bg-night">
      {view === "landing" ? (
        <LandingPage />
      ) : view === "auth" ? (
        <AuthPage />
      ) : (
        <div className="min-h-screen">
          <Sidebar />
          {view !== "viewer" && <TopBar />}
          <main
            className={`min-h-screen transition-all duration-300 ease-in-out ${
              collapsed
                ? "ml-[72px]"
                : "ml-[72px] md:ml-64"
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
