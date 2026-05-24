import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...body,
    };
    const logPath = path.join(process.cwd(), "client-errors.log");
    const logLine = JSON.stringify(logEntry) + "\n";
    await fs.appendFile(logPath, logLine, "utf-8");
    console.error("[CLIENT ERROR]", logEntry.message);
    if (logEntry.stack) {
      console.error("[CLIENT ERROR STACK]", logEntry.stack);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
