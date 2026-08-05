import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const dbType = dbUrl.startsWith("file:") ? "SQLite" : "PostgreSQL";

    // Count users
    let userCount = 0;
    try {
      userCount = await db.user.count();
    } catch (e) {
      // ignore
    }

    // List first 3 users
    let sampleUsers: Array<{ id: string; firstName: string; lastName: string; email: string }> = [];
    try {
      sampleUsers = await db.user.findMany({
        select: { id: true, firstName: true, lastName: true, email: true },
        take: 3,
      });
    } catch (e) {
      // ignore
    }

    // Test a search
    let searchResult = null;
    let searchError = null;
    try {
      searchResult = await db.user.findMany({
        where: { firstName: { contains: "e", mode: "insensitive" } },
        select: { id: true, firstName: true },
        take: 3,
      });
    } catch (e) {
      searchError = String(e);
    }

    return NextResponse.json({
      dbType,
      dbUrlPrefix: dbUrl.substring(0, 30) + "...",
      userCount,
      sampleUsers,
      searchTest: searchResult ? { count: searchResult.length } : null,
      searchError,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
