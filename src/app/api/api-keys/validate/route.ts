import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();
    if (!key) {
      return NextResponse.json({ valid: false, error: "No key provided" });
    }
    const isGoogle = key.startsWith("AIza");
    const isOpenAI = key.startsWith("sk-");
    if (isGoogle || isOpenAI) {
      return NextResponse.json({ valid: true, provider: isGoogle ? "google" : "openai" });
    }
    return NextResponse.json({ valid: false, error: "Unrecognized key format" });
  } catch {
    return NextResponse.json({ valid: false, error: "Validation failed" });
  }
}
