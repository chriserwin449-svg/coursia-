import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl || dbUrl.startsWith("file:")) {
      return NextResponse.json({ 
        success: false, 
        message: "DATABASE_URL is not configured for Supabase. Please set your Supabase connection string." 
      }, { status: 400 });
    }

    // Push schema to database
    execSync("npx prisma db push --accept-data-loss 2>&1", {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 60000,
      stdio: "pipe",
    });

    // Regenerate Prisma client
    execSync("npx prisma generate 2>&1", {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 30000,
      stdio: "pipe",
    });

    return NextResponse.json({ 
      success: true, 
      message: "Database connected and schema pushed successfully!" 
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Setup failed";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const isSupabase = dbUrl && !dbUrl.startsWith("file:");
  
  return NextResponse.json({
    configured: !!isSupabase,
    type: isSupabase ? "postgresql" : "sqlite",
  });
}
