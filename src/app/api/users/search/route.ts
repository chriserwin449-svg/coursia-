import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/users/search?q=<query>
 * Search users by firstName, lastName, email, or username (case-insensitive).
 * Uses Prisma ORM for cross-database compatibility (SQLite + PostgreSQL).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    const requestUserId = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";

    // Use Prisma ORM for cross-database compatibility
    // mode: "insensitive" works for both PostgreSQL and SQLite (Prisma 4.x+)
    const users = await db.user.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
        // Only apply self-exclusion if requestUserId looks like a real UUID/CUID
        // (the Bearer token is a 64-char hex string, not a user ID)
        ...(requestUserId && requestUserId.length <= 30 ? { NOT: { id: requestUserId } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
      },
      take: 10,
    });

    console.log(`✅ [users/search] Query "${q}" → ${users.length} results`);

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[users/search] Error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
