import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Verify database connection by running a simple query
    await db.$queryRaw`SELECT 1 AS ok`;

    return NextResponse.json({
      success: true,
      message: "Database connection verified successfully.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Database connection error:", msg);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to the database.",
        error: msg,
      },
      { status: 500 },
    );
  }
}
