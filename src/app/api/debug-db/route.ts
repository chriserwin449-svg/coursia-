import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/debug-db
 * Diagnostic endpoint — reveals DB type, connection status, schema columns, etc.
 * Helps identify why registration fails on Vercel.
 */
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const isPostgres = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");
    const isSqlite = dbUrl.startsWith("file:");

    // Test connection
    let connectionOk = false;
    let connectionError = "";
    try {
      await db.$queryRaw`SELECT 1 as ok`;
      connectionOk = true;
    } catch (err) {
      connectionError = err instanceof Error ? err.message : String(err);
    }

    // Check User table columns (PostgreSQL only)
    let columns: string[] = [];
    if (isPostgres && connectionOk) {
      try {
        const result = await db.$queryRawUnsafe(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position`
        ) as Array<{ column_name: string }>;
        columns = result.map((r) => r.column_name);
      } catch (err) {
        columns = [`Error: ${err instanceof Error ? err.message : String(err)}`];
      }
    }

    // Check if required columns exist
    const requiredColumns = ["subscriptionPlan", "subscriptionStatus", "creemSubscriptionId", "creemCustomerId", "subscriptionStartDate", "subscriptionEndDate", "trialStartDate"];
    const missingColumns = requiredColumns.filter((c) => !columns.includes(c));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: {
        type: isPostgres ? "postgresql" : isSqlite ? "sqlite" : "unknown",
        url_prefix: dbUrl.substring(0, 30) + "...",
        connectionOk,
        connectionError,
      },
      userTable: {
        exists: columns.length > 0,
        columnCount: columns.length,
        columns,
      },
      schema: {
        requiredColumns,
        missingColumns,
        allColumnsPresent: missingColumns.length === 0,
      },
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasOpenaiKey: !!process.env.OPENAI_API_KEY,
        hasCreemKey: !!process.env.CREEM_API_KEY,
        nodeEnv: process.env.NODE_ENV || "not set",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: "Debug endpoint failed",
      message: msg,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV || "not set",
      },
    }, { status: 500 });
  }
}
