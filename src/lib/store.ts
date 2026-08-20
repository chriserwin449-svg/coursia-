"use client";

import { create } from "zustand";
import { identifyUser, resetUser } from "./posthog";

export type AppView = "landing" | "auth" | "create" | "library" | "viewer" | "journey" | "offers" | "notifications";
export type AppLang = "fr" | "en";

export interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
}

export interface CourseChapter {
  id: string;
  title: string;
  content: string;
  summary: string;
  order: number;
  level: number;
  quiz?: QuizData | null;
  progress?: ChapterProgressData | null;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
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
  maxUnlockedLevel: number;
  stoppedAtLevel: number;
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
  // Subscription
  userPlan: string;
  setUserPlan: (plan: string) => void;
  hasSubscription: boolean;
  setHasSubscription: (v: boolean) => void;
  subscriptionStatus: string;
  setSubscriptionStatus: (s: string) => void;
  // Trial
  inTrial: boolean;
  setInTrial: (v: boolean) => void;
  trialDaysRemaining: number;
  setTrialDaysRemaining: (d: number) => void;
  trialCoursesGenerated: number;
  setTrialCoursesGenerated: (c: number) => void;
  // Grace period
  inGracePeriod: boolean;
  setInGracePeriod: (v: boolean) => void;
  graceDaysRemaining: number;
  setGraceDaysRemaining: (d: number) => void;
  // Renewal
  showRenewalReminder: boolean;
  setShowRenewalReminder: (v: boolean) => void;
  renewalDaysRemaining: number;
  setRenewalDaysRemaining: (d: number) => void;
  // Notification dot
  hasNotification: boolean;
  setHasNotification: (v: boolean) => void;
  notificationMessage: string;
  setNotificationMessage: (v: string) => void;
  notificationDismissed: boolean;
  setNotificationDismissed: (v: boolean) => void;
  // Pending course generation (saved before payment, resumed after)
  pendingGeneration: { topic: string; courseLang: string; level: number; isRandom: boolean } | null;
  setPendingGeneration: (v: { topic: string; courseLang: string; level: number; isRandom: boolean } | null) => void;
  // Courses list (global sync between views)
  courses: CourseData[];
  setCourses: (courses: CourseData[]) => void;
  addCourse: (course: CourseData) => void;
  removeCourse: (courseId: string) => void;
  // Free course tracking (from database — single source of truth)
  freeCourseUsed: boolean;
  setFreeCourseUsed: (v: boolean) => void;
  // 48h expiry warning
  expiryWarning48h: boolean;
  setExpiryWarning48h: (v: boolean) => void;
  // Legal pages
  legalPage: null | "privacy" | "terms";
  setLegalPage: (page: null | "privacy" | "terms") => void;
  // Background generation tracking (survives page navigation)
  backgroundGeneration: { title: string; startedAt: number; userId: string } | null;
  setBackgroundGeneration: (v: { title: string; startedAt: number; userId: string } | null) => void;
  // Real-time generation progress (from polling: chapter X/Y done)
  generationProgress: { total: number; done: number } | null;
  setGenerationProgress: (v: { total: number; done: number } | null) => void;
  // Journey target user (for viewing another user's learning path)
  journeyTargetUser: { id: string; firstName: string; lastName: string; avatar?: string | null } | null;
  setJourneyTargetUser: (v: { id: string; firstName: string; lastName: string; avatar?: string | null } | null) => void;
  // Notifications
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string | null;
    data: string | null;
    isRead: boolean;
    createdAt: string;
  }>;
  setNotifications: (n: Array<{
    id: string;
    type: string;
    title: string;
    message: string | null;
    data: string | null;
    isRead: boolean;
    createdAt: string;
  }>) => void;
  unreadNotificationCount: number;
  setUnreadNotificationCount: (n: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  lang: (typeof window !== "undefined" && localStorage.getItem("coursia-lang"))
    ? (localStorage.getItem("coursia-lang") as AppLang)
    : "en",
  setLang: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("coursia-lang", lang);
    }
    set({ lang });
  },
  user: null,
  setUser: (user) => {
    if (user) {
      identifyUser(user.id, {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
    }
    set({
      user,
      isAuthenticated: !!user,
      userName: user?.firstName ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    });
  },
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
    resetUser();
    get().setUser(null);
    get().setAuthToken(null);
    set({ view: "landing" });
  },
  // Navigation
  view: "landing",
  setView: (view) => set({
    view,
    ...(view === "viewer" ? { showQuiz: false, showFinalQuiz: false, isFullscreen: false, sidebarCollapsed: true } : { currentChapterIndex: 0, showQuiz: false, showFinalQuiz: false, isFullscreen: false }),
    ...(view !== "viewer" ? { selectedCourseId: null } : {}),
  }),
  selectedCourseId: null,
  setSelectedCourseId: (id) => set({ selectedCourseId: id, showQuiz: false, showFinalQuiz: false, sidebarCollapsed: true }),
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
  // Subscription
  userPlan: "free",
  setUserPlan: (plan) => set({ userPlan: plan }),
  hasSubscription: false,
  setHasSubscription: (v) => set({ hasSubscription: v }),
  subscriptionStatus: "none",
  setSubscriptionStatus: (s) => set({ subscriptionStatus: s }),
  // Trial
  inTrial: false,
  setInTrial: (v) => set({ inTrial: v }),
  trialDaysRemaining: 0,
  setTrialDaysRemaining: (d) => set({ trialDaysRemaining: d }),
  trialCoursesGenerated: 0,
  setTrialCoursesGenerated: (c) => set({ trialCoursesGenerated: c }),
  // Grace period
  inGracePeriod: false,
  setInGracePeriod: (v) => set({ inGracePeriod: v }),
  graceDaysRemaining: 0,
  setGraceDaysRemaining: (d) => set({ graceDaysRemaining: d }),
  // Renewal
  showRenewalReminder: false,
  setShowRenewalReminder: (v) => set({ showRenewalReminder: v }),
  renewalDaysRemaining: 0,
  setRenewalDaysRemaining: (d) => set({ renewalDaysRemaining: d }),
  // Notification dot
  hasNotification: false,
  setHasNotification: (v) => set({ hasNotification: v }),
  notificationMessage: "",
  setNotificationMessage: (v) => set({ notificationMessage: v }),
  notificationDismissed: false,
  setNotificationDismissed: (v) => set({ notificationDismissed: v }),
  // Pending course generation
  pendingGeneration: null,
  setPendingGeneration: (v) => {
    if (typeof window !== "undefined") {
      if (v) {
        localStorage.setItem("coursia-pending-generation", JSON.stringify(v));
      } else {
        localStorage.removeItem("coursia-pending-generation");
      }
    }
    set({ pendingGeneration: v });
  },
  // Courses list (global sync between views)
  courses: [],
  setCourses: (courses) => set({ courses }),
  addCourse: (course) => set((s) => ({ courses: [course, ...s.courses] })),
  removeCourse: (courseId) => set((s) => ({ courses: s.courses.filter(c => c.id !== courseId) })),
  // Free course tracking (from database — single source of truth)
  freeCourseUsed: false,
  setFreeCourseUsed: (v) => set({ freeCourseUsed: v }),
  // 48h expiry warning
  expiryWarning48h: false,
  setExpiryWarning48h: (v) => set({ expiryWarning48h: v }),
  // Legal pages
  legalPage: null,
  setLegalPage: (page) => set({ legalPage: page }),
  // Background generation tracking (survives page navigation)
  generationProgress: null,
  setGenerationProgress: (v) => set({ generationProgress: v }),
  backgroundGeneration: (typeof window !== "undefined" ? (() => { try { const v = localStorage.getItem("coursia-bg-generation"); return v ? JSON.parse(v) : null; } catch { return null; } })() : null) as { title: string; startedAt: number; userId: string } | null,
  // Journey target user
  journeyTargetUser: null as { id: string; firstName: string; lastName: string; avatar?: string | null } | null,
  setJourneyTargetUser: (v) => set({ journeyTargetUser: v }),
  // Notifications
  notifications: [],
  setNotifications: (n) => set({ notifications: n }),
  unreadNotificationCount: 0,
  setUnreadNotificationCount: (n) => set({ unreadNotificationCount: n }),
  setBackgroundGeneration: (v) => {
    if (typeof window !== "undefined") {
      if (v) {
        localStorage.setItem("coursia-bg-generation", JSON.stringify(v));
      } else {
        localStorage.removeItem("coursia-bg-generation");
      }
    }
    set({ backgroundGeneration: v });
  },
}));
