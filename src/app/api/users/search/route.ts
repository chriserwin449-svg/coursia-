import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

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

    let users: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      username: string | null;
      avatar: string | null;
    }> = [];

    // ── Attempt 1: Prisma ORM (works for both SQLite & PostgreSQL) ──
    try {
      const dbUrl = process.env.DATABASE_URL || "";
      const isPostgres = dbUrl.startsWith("postgresql") || dbUrl.startsWith("postgres");

      if (isPostgres) {
        // PostgreSQL — use mode: "insensitive"
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
        // SQLite — LIKE is case-insensitive for ASCII, use raw SQL with Prisma.sql tagged template
        const pattern = `%${q}%`;
        users = await db.$queryRaw(Prisma.sql`
          SELECT id, "firstName", "lastName", email, username, avatar FROM "User"
          WHERE "firstName" LIKE ${pattern}
             OR "lastName" LIKE ${pattern}
             OR email LIKE ${pattern}
             OR username LIKE ${pattern}
          LIMIT 10
        `) as typeof users;
      }
      console.log(`[users/search] Prisma query "${q}" -> ${users.length} results`);
    } catch (e1) {
      console.error("[users/search] Prisma failed, trying raw SQL fallback:", e1);

      // ── Attempt 2: Raw SQL fallback ──
      try {
        const dbUrl = process.env.DATABASE_URL || "";
        if (dbUrl.startsWith("file:")) {
          // SQLite raw with Prisma.sql
          const pattern = `%${q}%`;
          users = await db.$queryRaw(Prisma.sql`
            SELECT id, "firstName", "lastName", email, username, avatar FROM "User"
            WHERE "firstName" LIKE ${pattern} OR "lastName" LIKE ${pattern} OR email LIKE ${pattern} OR username LIKE ${pattern}
            LIMIT 10
          `) as typeof users;
        } else {
          // PostgreSQL ILIKE
          const pattern = `%${q}%`;
          users = await db.$queryRaw(Prisma.sql`
            SELECT id, "firstName", "lastName", email, username, avatar FROM "User"
            WHERE "firstName" ILIKE ${pattern} OR "lastName" ILIKE ${pattern} OR email ILIKE ${pattern} OR username ILIKE ${pattern}
            LIMIT 10
          `) as typeof users;
        }
        console.log(`[users/search] Raw SQL fallback "${q}" -> ${users.length} results`);
      } catch (e2) {
        console.error("[users/search] Raw SQL also failed, trying $queryRawUnsafe:", e2);

        // ── Attempt 3: Last resort unsafe query ──
        try {
          const dbUrl = process.env.DATABASE_URL || "";
          if (dbUrl.startsWith("file:")) {
            users = await db.$queryRawUnsafe(
              `SELECT id, "firstName", "lastName", email, username, avatar FROM "User" WHERE "firstName" LIKE '%' || ?1 || '%' OR "lastName" LIKE '%' || ?1 || '%' OR email LIKE '%' || ?1 || '%' OR username LIKE '%' || ?1 || '%' LIMIT 10`,
              q
            ) as typeof users;
          } else {
            users = await db.$queryRawUnsafe(
              `SELECT id, "firstName", "lastName", email, username, avatar FROM "User" WHERE "firstName" ILIKE '%' || $1 || '%' OR "lastName" ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR username ILIKE '%' || $1 || '%' LIMIT 10`,
              q
            ) as typeof users;
          }
          console.log(`[users/search] Unsafe fallback "${q}" -> ${users.length} results`);
        } catch (e3) {
          console.error("[users/search] ALL attempts failed:", e3);
        }
      }
    }

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error("[users/search] Fatal error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
