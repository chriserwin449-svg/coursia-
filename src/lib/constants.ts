/**
 * Centralized application constants.
 * Single source of truth for values used across multiple files.
 */

// ─── Subscription & Pricing ──────────────────────────────────────────────
export const PLAN_PRICES = {
  monthly: { dollars: 9.99, cents: 999, currency: "USD" as const },
  annual: { dollars: 42.99, cents: 4299, currency: "USD" as const },
} as const;

export const PLAN_DURATIONS = {
  monthly: 30, // days
  annual: 365, // days
} as const;

// ─── Free Preview Limits ──────────────────────────────────────────────
export const FREE_COURSE_LIMIT = 3; // Max free courses without subscription
export const FREE_CHAPTER_LIMIT = 1; // Only first chapter readable without subscription

// ─── Course Generation ───────────────────────────────────────────────────
export const MIN_CHAPTERS = 4;
export const MAX_CHAPTERS = 6;
export const MIN_SUBCHAPTERS = 2;
export const MIN_WORDS_PER_CHAPTER = 400;
export const MAX_SOURCE_LINKS = 3;
export const SCRAPED_TEXT_MAX_LENGTH = 4000;
export const SCRAPED_TEXT_MIN_LENGTH = 50;
export const MAX_TOKENS = 16384;
export const AI_RETRY_COUNT = 2;
export const AI_RETRY_BACKOFF_MS = 2000;

// ─── Payment / PayPal ──────────────────────────────────────────────────
export const CHECKOUT_RATE_LIMIT = 3;
export const CHECKOUT_RATE_WINDOW_MS = 60_000;
export const CHECKOUT_RATE_CLEANUP_MS = 300_000;

// ─── UI Timers ──────────────────────────────────────────────────────────
export const CELEBRATION_DISPLAY_MS = 2_000;
export const LEVEL_REVIEW_DISPLAY_MS = 4_000;
export const STATUS_REFRESH_INTERVAL_MS = 30_000;
export const TYPING_SPEED_MS = 35;
export const TYPING_PAUSE_MS = 2_200;
export const TYPING_FADE_MS = 500;

// ─── LocalStorage Keys ────────────────────────────────────────────────
export const AUTH_TOKEN_KEY = "coursia-auth-token";
