import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/users/search?q=<query>
 * Search users by firstName, lastName, email, or username (case-insensitive).
 *
 * Strategy:
 * - PostgreSQL (Supabase production): use `mode: "insensitive"` on Prisma `contains`
 * - SQLite (local dev): use raw SQL with LIKE (already case-insensitive for ASCII)
 *
 * We detect the DB type from DATABASE_URL and pick the right query.
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
    const isPostgres = !dbUrl.startsWith("file:");
    let users;

    if (isPostgres) {
      // PostgreSQL — Prisma supports mode: "insensitive"
      users = await db.user.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
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
    } else {
      // SQLite — use Prisma's raw query with tagged template for safe parameter binding
      // SQLite's LIKE is case-insensitive for ASCII by default
      const pattern = `%${q}%`;
      users = await db.$queryRaw<
        Array<{
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          username: string | null;
          avatar: string | null;
        }>
      >(
        Prisma.sql`SELECT id, "firstName", "lastName", email, username, avatar FROM "User" 
          WHERE "firstName" LIKE ${pattern} 
             OR "lastName" LIKE ${pattern} 
             OR email LIKE ${pattern} 
             OR username LIKE ${pattern} 
          LIMIT 10`
      );
    }

    const count = Array.isArray(users) ? users.length : 0;
    console.log(
      `[users/search] Query "${q}" -> ${count} results (DB: ${isPostgres ? "PostgreSQL" : "SQLite"})`
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
