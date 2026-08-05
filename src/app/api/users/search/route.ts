import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/users/search?q=somename
 *
 * Searches for users by firstName, lastName, email or username.
 * Works with both SQLite (LIKE, case-insensitive for ASCII) and PostgreSQL (ILIKE).
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const dbUrl = process.env.DATABASE_URL || "";
    const isPostgres = dbUrl.includes("postgres");

    console.log(`[users/search] query="${q}", isPostgres=${isPostgres}`);

    let users: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      username: string | null;
      avatar: string | null;
    }> = [];

    try {
      if (isPostgres) {
        // PostgreSQL: use mode: "insensitive" for case-insensitive matching
        users = await db.user.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true, username: true, avatar: true },
          take: 10,
        });
      } else {
        // SQLite: contains → LIKE '%q%' which is case-insensitive for ASCII
        users = await db.user.findMany({
          where: {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { username: { contains: q } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true, username: true, avatar: true },
          take: 10,
        });
      }
      console.log(`[users/search] ✅ Found ${users.length} users for "${q}"`);
    } catch (prismaError) {
      console.error(`[users/search] Prisma findMany failed:`, prismaError);

      // Fallback: raw SQL
      try {
        if (isPostgres) {
          const pattern = `%${q}%`;
          const rows = await db.$queryRawUnsafe(
            `SELECT id, "firstName", "lastName", email, username, avatar FROM "User"
             WHERE "firstName" ILIKE $1 OR "lastName" ILIKE $1 OR email ILIKE $1 OR username ILIKE $1
             LIMIT 10`,
            pattern
          );
          users = rows as typeof users;
        } else {
          const pattern = `%${q}%`;
          const rows = await db.$queryRawUnsafe(
            `SELECT id, "firstName", "lastName", email, username, avatar FROM "User"
             WHERE "firstName" LIKE ?1 OR "lastName" LIKE ?1 OR email LIKE ?1 OR username LIKE ?1
             LIMIT 10`,
            pattern
          );
          users = rows as typeof users;
        }
        console.log(`[users/search] Raw SQL fallback found ${users.length} users`);
      } catch (rawError) {
        console.error(`[users/search] Raw SQL fallback also failed:`, rawError);
      }
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[users/search] Fatal error:", error);
    return NextResponse.json({ error: "Search failed", users: [] }, { status: 500 });
  }
}
