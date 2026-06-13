import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Supabase sync module for production deployment.
 * 
 * When Supabase is configured (env vars set), data is synced
 * to both the local SQLite (via Prisma) AND Supabase PostgreSQL.
 * 
 * This provides:
 * - Real-time collaboration
 * - Cross-device data access
 * - Cloud backup
 * - Scalability for production
 */

interface SyncResult {
  success: boolean;
  synced: boolean;
  supabaseAvailable: boolean;
  error?: string;
}

/**
 * Generic upsert to Supabase table
 */
async function upsertToSupabase(table: string, data: Record<string, unknown>): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return { success: true, synced: false, supabaseAvailable: false };
  }

  try {
    // Try update first (by id)
    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update(data)
      .eq("id", data.id as string);

    if (updateError) {
      // If no rows matched, try insert
      const { error: insertError } = await supabaseAdmin
        .from(table)
        .insert(data);

      if (insertError) {
        console.error(`[supabase-sync] Failed to sync ${table}:`, insertError.message);
        return { success: true, synced: false, supabaseAvailable: true, error: insertError.message };
      }
    }

    return { success: true, synced: true, supabaseAvailable: true };
  } catch (error) {
    console.error(`[supabase-sync] Error syncing ${table}:`, error);
    return { success: true, synced: false, supabaseAvailable: true, error: String(error) };
  }
}

/**
 * Sync user data to Supabase
 */
export async function syncUser(userData: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<SyncResult> {
  return upsertToSupabase("User", {
    id: userData.id,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
  });
}

/**
 * Sync course data to Supabase (including chapters)
 */
export async function syncCourse(courseData: {
  id: string;
  userId?: string | null;
  title: string;
  description: string;
  sourceLinks: string;
  level: number;
  flameCost: number;
  chapters?: Array<{
    id: string;
    title: string;
    content: string;
    summary: string;
    order: number;
    courseId: string;
  }>;
}): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return { success: true, synced: false, supabaseAvailable: false };
  }

  try {
    // Upsert course
    const { error: courseError } = await supabaseAdmin
      .from("Course")
      .upsert({
        id: courseData.id,
        userId: courseData.userId || null,
        title: courseData.title,
        description: courseData.description,
        sourceLinks: courseData.sourceLinks,
        level: courseData.level,
        flameCost: courseData.flameCost,
      });

    if (courseError) {
      console.error("[supabase-sync] Failed to sync course:", courseError.message);
      return { success: true, synced: false, supabaseAvailable: true, error: courseError.message };
    }

    // Sync chapters if provided
    if (courseData.chapters && courseData.chapters.length > 0) {
      const { error: chaptersError } = await supabaseAdmin
        .from("Chapter")
        .upsert(
          courseData.chapters.map((ch) => ({
            id: ch.id,
            title: ch.title,
            content: ch.content,
            summary: ch.summary,
            order: ch.order,
            courseId: ch.courseId,
          }))
        );

      if (chaptersError) {
        console.error("[supabase-sync] Failed to sync chapters:", chaptersError.message);
      }
    }

    return { success: true, synced: true, supabaseAvailable: true };
  } catch (error) {
    console.error("[supabase-sync] Error syncing course:", error);
    return { success: true, synced: false, supabaseAvailable: true, error: String(error) };
  }
}

/**
 * Sync chapter progress to Supabase
 */
export async function syncChapterProgress(progressData: {
  id: string;
  chapterId: string;
  completed: boolean;
  score: number;
  completedAt?: string | null;
  flameAwarded: boolean;
}): Promise<SyncResult> {
  return upsertToSupabase("ChapterProgress", {
    id: progressData.id,
    chapterId: progressData.chapterId,
    completed: progressData.completed,
    score: progressData.score,
    completedAt: progressData.completedAt || null,
    flameAwarded: progressData.flameAwarded,
  });
}

/**
 * Sync flame points to Supabase
 */
export async function syncFlamePoints(flamePoints: number): Promise<SyncResult> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return { success: true, synced: false, supabaseAvailable: false };
  }

  try {
    const { error } = await supabaseAdmin
      .from("AppSettings")
      .update({ flamePoints, updatedAt: new Date().toISOString() })
      .eq("id", "main");

    if (error) {
      console.error("[supabase-sync] Failed to sync flame points:", error.message);
      return { success: true, synced: false, supabaseAvailable: true, error: error.message };
    }

    return { success: true, synced: true, supabaseAvailable: true };
  } catch (error) {
    return { success: true, synced: false, supabaseAvailable: true, error: String(error) };
  }
}

/**
 * Sync flame transaction to Supabase
 */
export async function syncFlameTransaction(txData: {
  id: string;
  amount: number;
  reason: string;
  courseId?: string | null;
  chapterId?: string | null;
}): Promise<SyncResult> {
  return upsertToSupabase("FlameTransaction", {
    id: txData.id,
    amount: txData.amount,
    reason: txData.reason,
    courseId: txData.courseId || null,
    chapterId: txData.chapterId || null,
  });
}

/**
 * Check Supabase connection status
 */
export async function checkSupabaseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { configured: false, connected: false };
  }

  if (!supabaseAdmin) {
    return { configured: true, connected: false, error: "Service role key missing" };
  }

  try {
    const { error } = await supabaseAdmin
      .from("AppSettings")
      .select("id")
      .limit(1);

    if (error) {
      // Table might not exist yet — that's OK during initial setup
      if (error.message.includes("does not exist") || error.code === "42P01") {
        return { configured: true, connected: true, error: "Tables not created yet — run supabase-schema.sql" };
      }
      return { configured: true, connected: false, error: error.message };
    }

    return { configured: true, connected: true };
  } catch (error) {
    return { configured: true, connected: false, error: String(error) };
  }
}

/**
 * Legacy export for backward compatibility
 */
export async function syncToSupabase(data: unknown): Promise<SyncResult> {
  console.log("[supabase-sync] Using legacy sync — use specific sync functions instead");
  return { success: true, synced: false, supabaseAvailable: false };
}
