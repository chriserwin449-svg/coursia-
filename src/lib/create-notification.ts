import { db } from "@/lib/db";

/**
 * Create an in-app notification for a user.
 * Silent — errors are logged but never thrown.
 */
export async function createNotification(params: {
  userId: string;
  type: string;       // "course_shared" | "certificate_earned" | "badge_earned" | "flame_tier_up" | "payment_success" | "subscription_expiring" | "subscription_expired" | "subscription_canceled"
  title: string;
  message?: string;
  data?: Record<string, unknown>;
}) {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message || null,
        data: params.data ? JSON.stringify(params.data) : "{}",
        isRead: false,
      },
    });
  } catch (err) {
    console.warn("[createNotification] Failed:", err);
  }
}
