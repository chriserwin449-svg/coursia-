import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/users/search?q=<query>
 * Search users by firstName, lastName, email, or username (case-insensitive).
 * Requires Authorization header with Bearer token.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract the requesting user's ID to exclude from results
    const requestUserId = authHeader.replace("Bearer ", "").trim();

    // Use case-insensitive search for SQLite compatibility
    const qLower = q.toLowerCase();

    // Build raw SQL query for case-insensitive search across all fields
    // Exclude the requesting user so they can't share with themselves
    const users = await db.$queryRawUnsafe(
      `SELECT "id", "firstName", "lastName", "email", "username", "avatar"
       FROM "User"
       WHERE (
         LOWER("firstName") LIKE '%' || $1 || '%'
         OR LOWER("lastName") LIKE '%' || $1 || '%'
         OR LOWER("email") LIKE '%' || $1 || '%'
         OR LOWER("username") LIKE '%' || $1 || '%'
       )
       AND "id" != $2
       LIMIT 10`,
      qLower,
      requestUserId
    ) as Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      username: string | null;
      avatar: string | null;
    }>;

    console.log(`✅ [users/search] Query "${q}" → ${users.length} results`);

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[users/search] Error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
