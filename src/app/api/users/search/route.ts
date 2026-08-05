import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/users/search?q=<query>
 * Search users by firstName, lastName, email, or username (case-insensitive).
 * Uses raw SQL for reliable cross-database behavior:
 * - SQLite: LIKE is already case-insensitive for ASCII
 * - PostgreSQL: ILIKE for explicit case-insensitive matching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const dbUrl = process.env.DATABASE_URL || "";
    let users;

    if (dbUrl.startsWith("file:")) {
      // SQLite — LIKE is case-insensitive for ASCII by default
      users = await db.$queryRawUnsafe(
        `SELECT id, "firstName", "lastName", email, username, avatar FROM "User" WHERE "firstName" LIKE '%' || ?1 || '%' OR "lastName" LIKE '%' || ?1 || '%' OR email LIKE '%' || ?1 || '%' OR username LIKE '%' || ?1 || '%' LIMIT 10`,
        q
      );
    } else {
      // PostgreSQL — ILIKE for case-insensitive matching
      users = await db.$queryRawUnsafe(
        `SELECT id, "firstName", "lastName", email, username, avatar FROM "User" WHERE "firstName" ILIKE '%' || $1 || '%' OR "lastName" ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR username ILIKE '%' || $1 || '%' LIMIT 10`,
        q
      );
    }

    console.log(
      `[users/search] Query "${q}" -> ${Array.isArray(users) ? users.length : 0} results (DB: ${dbUrl.startsWith("file:") ? "SQLite" : "PostgreSQL"})`
    );

    return NextResponse.json({ users: Array.isArray(users) ? users : [] });
  } catch (error) {
    console.error("[users/search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
