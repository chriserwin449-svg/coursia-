import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Test 1: Connection
    await db.$queryRaw`SELECT 1 as ok`;

    // Test 2: Read tables
    const userCount = await db.user.count();
    const courseCount = await db.course.count();

    return NextResponse.json({
      status: "ok",
      database: "Supabase PostgreSQL",
      users: userCount,
      courses: courseCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      status: "error",
      error: msg,
    }, { status: 500 });
  }
}
