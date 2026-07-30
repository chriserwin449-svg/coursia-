/**
 * Flashdash — Analytics event tracker for Coursia
 * Sends server-side events to the Flashdash dashboard.
 *
 * Types autorisés : payment_success, payment_failed, refund, user_signup,
 *   user_active, user_login, ai_request, ai_error, course_generated,
 *   quiz_created, alert.
 *
 * Usage: import { flashdash } from "@/lib/flashdash";
 *        flashdash.userSignup({ userId: "xxx", email: "..." });
 */

const FLASHDASH_KEY = "cms7owjlw0001vb0as37yphx2";
const FLASHDASH_URL = "https://flashdash.space-z.ai/api/ingest";

// ─── Allowed event types (enforced by Flashdash API) ────────────────────────
type FlashdashEventType =
  | "payment_success"
  | "payment_failed"
  | "refund"
  | "user_signup"
  | "user_active"
  | "user_login"
  | "ai_request"
  | "ai_error"
  | "course_generated"
  | "quiz_created"
  | "alert";

type EventMeta = Record<string, unknown>;

async function sendEvent(type: FlashdashEventType, meta?: EventMeta): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(FLASHDASH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Key": FLASHDASH_KEY,
      },
      body: JSON.stringify({
        type,
        ...meta,
        timestamp: new Date().toISOString(),
        source: "coursia-api",
      }),
      signal: controller.signal,
    })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("[Flashdash] ingest failed:", err);
        }
      })
      .finally(() => clearTimeout(timeoutId));
  } catch (err) {
    // Silent fail — analytics should never break the app
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export const flashdash = {
  // ─── Auth ───
  userSignup: (userId: string, email: string) =>
    sendEvent("user_signup", { userId, email }),

  userLogin: (userId: string, email: string) =>
    sendEvent("user_login", { userId, email }),

  userActive: (userId: string, action: string) =>
    sendEvent("user_active", { userId, action }),

  // ─── Payments ───
  paymentSuccess: (userId: string, plan: string, amount: number, method: string = "paypal") =>
    sendEvent("payment_success", { userId, plan, amount, method }),

  paymentFailed: (userId: string, plan: string, reason: string) =>
    sendEvent("payment_failed", { userId, plan, reason }),

  subscriptionExtended: (userId: string, plan: string, amount?: number, method: string = "paypal") =>
    sendEvent("payment_success", { userId, plan, amount, method, recurring: true }),

  refund: (userId: string, plan: string, amount: number, reason?: string) =>
    sendEvent("refund", { userId, plan, amount, reason }),

  // ─── Courses ───
  courseGenerated: (userId: string | null, courseId: string, title: string, chapterCount: number, level: number = 0, durationMs: number = 0) =>
    sendEvent("course_generated", { userId, courseId, title, chapterCount, level, durationMs }),

  // ─── Quizzes ───
  quizCreated: (courseId: string, level: number, score?: number, passed?: boolean) =>
    sendEvent("quiz_created", { courseId, level, score, passed }),

  // ─── AI ───
  aiRequest: (endpoint: string, model: string, durationMs: number, tokens?: number) =>
    sendEvent("ai_request", { endpoint, model, durationMs, tokens }),

  aiError: (endpoint: string, error: string, severity: string = "warning") =>
    sendEvent("ai_error", { endpoint, error, severity }),

  // ─── Alerts / Custom ───
  alert: (message: string, severity: "info" | "warning" | "error" = "info", meta?: EventMeta) =>
    sendEvent("alert", { message, severity, ...meta }),
};
