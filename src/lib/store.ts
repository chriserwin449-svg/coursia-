import { create } from "zustand";

export type AppView = "landing" | "create" | "library" | "viewer" | "journey" | "offers";
export type AppLang = "fr" | "en";

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
  createdAt: string;
  chapters: CourseChapter[];
  overallProgress: number;
}

interface AppState {
  lang: AppLang;
  setLang: (l: AppLang) => void;
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
}

export const useAppStore = create<AppState>((set) => ({
  lang: "fr",
  setLang: (lang) => set({ lang }),
  view: "landing",
  setView: (view) => set({
    view,
    currentChapterIndex: 0,
    showQuiz: false,
    isFullscreen: false,
    ...(view !== "viewer" ? { selectedCourseId: null } : {}),
  }),
  selectedCourseId: null,
  setSelectedCourseId: (id) => set({ selectedCourseId: id, currentChapterIndex: 0, showQuiz: false }),
  currentChapterIndex: 0,
  setCurrentChapterIndex: (index) => set({ currentChapterIndex: index, showQuiz: false }),
  isFullscreen: false,
  setIsFullscreen: (v) => set({ isFullscreen: v }),
  showQuiz: false,
  setShowQuiz: (v) => set({ showQuiz: v }),
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
}));
