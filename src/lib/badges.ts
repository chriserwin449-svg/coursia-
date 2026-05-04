export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  threshold: number;
  color: string;
  bgColor: string;
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  {
    id: "premier-pas",
    name: "Premier Pas",
    description: "Tu as créé ton premier cours ! Le voyage commence ici.",
    emoji: "🌱",
    threshold: 1,
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.15)",
  },
  {
    id: "explorateur",
    name: "Explorateur",
    description: "5 cours créés ! Tu explores de nouveaux horizons.",
    emoji: "🧭",
    threshold: 5,
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.15)",
  },
  {
    id: "curieux",
    name: "Curieux",
    description: "10 cours ! Ta curiosité est ta plus grande force.",
    emoji: "🔍",
    threshold: 10,
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.15)",
  },
  {
    id: "apprenti",
    name: "Apprenti Dévoué",
    description: "15 cours étudiés. L'apprentissage devient une habitude.",
    emoji: "📚",
    threshold: 15,
    color: "#a855f7",
    bgColor: "rgba(168, 85, 247, 0.15)",
  },
  {
    id: "passionne",
    name: "Passionné",
    description: "25 cours ! La passion te guide vers l'excellence.",
    emoji: "🔥",
    threshold: 25,
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.15)",
  },
  {
    id: "expert",
    name: "Expert",
    description: "50 cours maîtrisés. Tu es devenu une référence.",
    emoji: "🏆",
    threshold: 50,
    color: "#d4a843",
    bgColor: "rgba(212, 168, 67, 0.15)",
  },
  {
    id: "maitre",
    name: "Maître",
    description: "75 cours ! La maîtrise absolue est à portée de main.",
    emoji: "👑",
    threshold: 75,
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.15)",
  },
  {
    id: "legende",
    name: "Légende Vivante",
    description: "100 cours accomplis. Tu es une légende de l'apprentissage.",
    emoji: "✨",
    threshold: 100,
    color: "#e8c46a",
    bgColor: "rgba(232, 196, 106, 0.15)",
  },
];

export function getEarnedBadges(completedCoursesCount: number): BadgeDef[] {
  return BADGE_DEFINITIONS.filter((b) => completedCoursesCount >= b.threshold);
}

export function getNextBadge(completedCoursesCount: number): BadgeDef | null {
  return BADGE_DEFINITIONS.find((b) => completedCoursesCount < b.threshold) || null;
}

export function getBadgeProgress(completedCoursesCount: number): {
  current: number;
  next: number;
  percentage: number;
} {
  const earned = BADGE_DEFINITIONS.filter((b) => completedCoursesCount >= b.threshold);
  const next = BADGE_DEFINITIONS.find((b) => completedCoursesCount < b.threshold);
  const currentThreshold = earned.length > 0 ? earned[earned.length - 1].threshold : 0;
  const nextThreshold = next ? next.threshold : 100;
  const progress = next
    ? ((completedCoursesCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;
  return {
    current: currentThreshold,
    next: nextThreshold,
    percentage: Math.min(progress, 100),
  };
}
