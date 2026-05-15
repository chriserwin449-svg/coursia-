import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Decay is handled in GET /api/flames
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[flame-decay] Error:", error);
    return NextResponse.json({ error: "Decay check failed" }, { status: 500 });
  }
}
