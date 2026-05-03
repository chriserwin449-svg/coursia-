import { create } from "zustand";

export type AppView = "landing" | "create" | "library" | "viewer" | "journey";

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
  // Navigation
  view: AppView;
  setView: (view: AppView) => void;

  // Selected course for viewing
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;

  // Current chapter in viewer
  currentChapterIndex: number;
  setCurrentChapterIndex: (index: number) => void;

  // Fullscreen mode
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;

  // Show quiz for current chapter
  showQuiz: boolean;
  setShowQuiz: (v: boolean) => void;

  // Generation loading state
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;

  // Quiz submission state
  isSubmittingQuiz: boolean;
  setIsSubmittingQuiz: (v: boolean) => void;

  // Celebration state
  showCelebration: boolean;
  setShowCelebration: (v: boolean) => void;
  celebrationMessage: string;
  setCelebrationMessage: (msg: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "landing",
  setView: (view) => set({ view, selectedCourseId: null, currentChapterIndex: 0, showQuiz: false, isFullscreen: false }),

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
}));
