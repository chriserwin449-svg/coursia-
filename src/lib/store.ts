"use client";

import { create } from "zustand";

export type AppView = "landing" | "auth" | "create" | "library" | "viewer" | "journey" | "offers";
export type AppLang = "fr" | "en";
export type UserPlan = "free" | "pro" | "lifetime";

export interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface CourseChapter {
  id: string;
  title: string;
  content: string;
  summary: string;
  order: number;
  quiz?: QuizData | null;
  progress?: ChapterProgressData | null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizData {
  id: string;
  questions: QuizQuestion[];
}

export interface ChapterProgressData {
  completed: boolean;
  score: number;
  completedAt?: string;
}

export interface CourseData {
  id: string;
  title: string;
  description: string;
  sourceLinks: string[];
  level: number;
  createdAt: string;
  chapters: CourseChapter[];
  overallProgress: number;
  courseCompleted?: boolean;
  courseScore?: number;
}

interface AppState {
  lang: AppLang;
  setLang: (l: AppLang) => void;
  user: UserData | null;
  setUser: (user: UserData | null) => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  // Derived auth fields (for hooks compatibility)
  isAuthenticated: boolean;
  userName: string | null;
  userId: string | null;
  userEmail: string | null;
  logout: () => void;
  // Plan fields (for usePlan hook)
  userPlan: UserPlan;
  planFeatures: Record<string, boolean>;
  setUserPlan: (plan: UserPlan) => void;
  // Navigation
  view: AppView;
  setView: (view: AppView) => void;
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  showQuiz: boolean;
  setShowQuiz: (v: boolean) => void;
  showFinalQuiz: boolean;
  setShowFinalQuiz: (v: boolean) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  isSubmittingQuiz: boolean;
  setIsSubmittingQuiz: (v: boolean) => void;
  showCelebration: boolean;
  setShowCelebration: (v: boolean) => void;
  celebrationMessage: string;
  setCelebrationMessage: (msg: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  randomTopic: string | null;
  setRandomTopic: (topic: string | null) => void;
  randomCourseLang: string;
  setRandomCourseLang: (lang: string) => void;
  showLevelUp: boolean;
  setShowLevelUp: (v: boolean) => void;
  levelUpData: { title: string; currentLevel: number; nextLevel: number } | null;
  setLevelUpData: (d: { title: string; currentLevel: number; nextLevel: number } | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  lang: "fr",
  setLang: (lang) => set({ lang }),
  user: null,
  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    userName: user?.firstName ?? null,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
  }),
  authToken: null,
  setAuthToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("coursia-auth-token", token);
      } else {
        localStorage.removeItem("coursia-auth-token");
      }
    }
    set({ authToken: token });
  },
  // Derived auth fields
  isAuthenticated: false,
  userName: null,
  userId: null,
  userEmail: null,
  logout: () => {
    get().setUser(null);
    get().setAuthToken(null);
    set({ view: "landing" });
  },
  // Plan fields
  userPlan: "free" as UserPlan,
  planFeatures: {
    unlimitedCourses: false,
    prioritySupport: false,
    earlyAccess: false,
  },
  setUserPlan: (plan) => set({
    userPlan: plan,
    planFeatures: {
      unlimitedCourses: plan !== "free",
      prioritySupport: plan !== "free",
      earlyAccess: plan === "lifetime",
    },
  }),
  // Navigation
  view: "landing",
  setView: (view) => set({
    view,
    currentChapterIndex: 0,
    showQuiz: false,
    showFinalQuiz: false,
    isFullscreen: false,
    ...(view !== "viewer" ? { selectedCourseId: null } : {}),
    ...(view === "viewer" ? { sidebarCollapsed: true } : {}),
  }),
  selectedCourseId: null,
  setSelectedCourseId: (id) => set({ selectedCourseId: id, currentChapterIndex: 0, showQuiz: false, showFinalQuiz: false, sidebarCollapsed: true }),
  currentChapterIndex: 0,
  setCurrentChapterIndex: (index) => set({ currentChapterIndex: index, showQuiz: false }),
  isFullscreen: false,
  setIsFullscreen: (v) => set({ isFullscreen: v }),
  showQuiz: false,
  setShowQuiz: (v) => set({ showQuiz: v }),
  showFinalQuiz: false,
  setShowFinalQuiz: (v) => set({ showFinalQuiz: v }),
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),
  isSubmittingQuiz: false,
  setIsSubmittingQuiz: (v) => set({ isSubmittingQuiz: v }),
  showCelebration: false,
  setShowCelebration: (v) => set({ showCelebration: v }),
  celebrationMessage: "",
  setCelebrationMessage: (msg) => set({ celebrationMessage: msg }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  randomTopic: null,
  setRandomTopic: (topic) => set({ randomTopic: topic }),
  randomCourseLang: "fr",
  setRandomCourseLang: (lang) => set({ randomCourseLang: lang }),
  showLevelUp: false,
  setShowLevelUp: (v) => set({ showLevelUp: v }),
  levelUpData: null,
  setLevelUpData: (d) => set({ levelUpData: d }),
}));
