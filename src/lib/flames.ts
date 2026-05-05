// Flame type definitions for the gamification system

export interface FlameType {
  id: string;
  name: string;          // e.g. "Étincelle"
  nameEn: string;        // English name e.g. "Spark"
  emoji: string;         // e.g. "✨"
  minPoints: number;     // minimum flame points to unlock this type
  maxPoints: number;     // max points before next type (9999 for highest)
  color: string;         // gradient color e.g. "#f59e0b"
  description: string;
  descriptionEn: string;
}

export const FLAME_TYPES: FlameType[] = [
  {
    id: "etincelle",
    name: "Étincelle",
    nameEn: "Spark",
    emoji: "✨",
    minPoints: 0,
    maxPoints: 99,
    color: "#f59e0b",
    description: "Ton premier éclair de passion.",
    descriptionEn: "Your first spark of passion.",
  },
  {
    id: "flamme",
    name: "Flamme",
    nameEn: "Flame",
    emoji: "🔥",
    minPoints: 100,
    maxPoints: 499,
    color: "#f97316",
    description: "Ta constance s'enflamme.",
    descriptionEn: "Your consistency catches fire.",
  },
  {
    id: "brasier",
    name: "Brasier",
    nameEn: "Brazier",
    emoji: "🌋",
    minPoints: 500,
    maxPoints: 1499,
    color: "#ef4444",
    description: "Le feu brûle en toi.",
    descriptionEn: "The fire burns within you.",
  },
  {
    id: "incendie",
    name: "Incendie",
    nameEn: "Wildfire",
    emoji: "💥",
    minPoints: 1500,
    maxPoints: 3499,
    color: "#dc2626",
    description: "Rien ne peut t'arrêter.",
    descriptionEn: "Nothing can stop you.",
  },
  {
    id: "meteor",
    name: "Météore",
    nameEn: "Meteor",
    emoji: "☄️",
    minPoints: 3500,
    maxPoints: 6999,
    color: "#7c3aed",
    description: "Tu es une force de la nature.",
    descriptionEn: "You are a force of nature.",
  },
  {
    id: "supernova",
    name: "Supernova",
    nameEn: "Supernova",
    emoji: "🌟",
    minPoints: 7000,
    maxPoints: 9999,
    color: "#a855f7",
    description: "Tu es une étoile naissante.",
    descriptionEn: "You are a rising star.",
  },
  {
    id: "legende",
    name: "Légende",
    nameEn: "Legend",
    emoji: "👑",
    minPoints: 10000,
    maxPoints: 10000,
    color: "#facc15",
    description: "La légende absolue.",
    descriptionEn: "The absolute legend.",
  },
];

export const COURSE_CREATION_COST = 100;

export interface FlameReward {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  points: number;      // total points needed
  emoji: string;
  isEarned: boolean;   // computed at runtime, default false
}

export const FLAME_REWARDS: FlameReward[] = [
  {
    id: "cinephile",
    name: "Cinéphile",
    nameEn: "Movie Buff",
    description: "Crée 3 cours",
    descriptionEn: "Create 3 courses",
    points: 300,
    emoji: "🎬",
    isEarned: false,
  },
  {
    id: "bibliothecaire",
    name: "Bibliothécaire",
    nameEn: "Librarian",
    description: "Crée 10 cours",
    descriptionEn: "Create 10 courses",
    points: 1000,
    emoji: "📚",
    isEarned: false,
  },
  {
    id: "champion",
    name: "Champion",
    nameEn: "Champion",
    description: "Score 100% à 5 quiz",
    descriptionEn: "Score 100% on 5 quizzes",
    points: 2000,
    emoji: "🏆",
    isEarned: false,
  },
  {
    id: "eclair",
    name: "Éclair",
    nameEn: "Lightning",
    description: "Termine un cours en une session",
    descriptionEn: "Complete a course in one session",
    points: 500,
    emoji: "⚡",
    isEarned: false,
  },
  {
    id: "precision",
    name: "Précision",
    nameEn: "Precision",
    description: "Score 100% à un quiz final",
    descriptionEn: "Score 100% on a final quiz",
    points: 1500,
    emoji: "🎯",
    isEarned: false,
  },
  {
    id: "diamant",
    name: "Diamant",
    nameEn: "Diamond",
    description: "Atteins 5000 points de flamme",
    descriptionEn: "Reach 5000 flame points",
    points: 5000,
    emoji: "💎",
    isEarned: false,
  },
  {
    id: "volcan",
    name: "Volcan",
    nameEn: "Volcano",
    description: "Atteins 7500 points de flamme",
    descriptionEn: "Reach 7500 flame points",
    points: 7500,
    emoji: "🌋",
    isEarned: false,
  },
  {
    id: "legende-reward",
    name: "Légende",
    nameEn: "Legend",
    description: "Atteins 10000 points de flamme",
    descriptionEn: "Reach 10000 flame points",
    points: 10000,
    emoji: "👑",
    isEarned: false,
  },
];

/**
 * Returns the flame type for the given point level.
 */
export function getCurrentFlameType(points: number): FlameType {
  for (let i = FLAME_TYPES.length - 1; i >= 0; i--) {
    if (points >= FLAME_TYPES[i].minPoints) {
      return FLAME_TYPES[i];
    }
  }
  return FLAME_TYPES[0];
}

/**
 * Returns progress toward next flame type.
 * current = points earned in current tier,
 * next = total points needed for next tier,
 * percentage = 0-100 progress within current tier.
 * For the max tier (Légende), returns 100%.
 */
export function getFlameProgress(points: number): {
  current: number;
  next: number;
  percentage: number;
} {
  const flameType = getCurrentFlameType(points);

  // Already at max tier
  if (flameType.minPoints === flameType.maxPoints) {
    return { current: 0, next: flameType.minPoints, percentage: 100 };
  }

  const current = points - flameType.minPoints;
  const next = flameType.maxPoints + 1;
  const range = next - flameType.minPoints;
  const percentage = Math.min(100, Math.round((current / range) * 100));

  return { current, next, percentage };
}

/**
 * Calculate flame points earned from a quiz score (score 0-100).
 * Formula: Math.round(score * 0.5)
 * e.g. 100% = 50 pts, 80% = 40 pts, 60% = 30 pts
 */
export function calculateFlameEarned(score: number): number {
  return Math.round(score * 0.5);
}

/**
 * Format large numbers with space as thousands separator.
 * e.g. 1500 → "1 500", 10000 → "10 000"
 */
export function formatFlamePoints(points: number): string {
  return points.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
