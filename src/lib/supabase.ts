/**
 * Supabase database direct connection via Prisma.
 *
 * We do NOT use Supabase Auth or the Supabase JS client.
 * All database operations go through Prisma + PostgreSQL.
 * All authentication is handled with bcrypt (see api/auth/* routes).
 *
 * This file is intentionally minimal — it only exports a helper
 * to check if Supabase is reachable via Prisma.
 */

import { db } from "@/lib/db";

export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
