import { NextResponse } from "next/server";

export async function GET() {
  try {
    const levels = [
      { name: "Étincelle", min: 0, icon: "✨" },
      { name: "Flamme", min: 50, icon: "🔥" },
      { name: "Flamme ardente", min: 150, icon: "🔥" },
      { name: "Enfer", min: 400, icon: "💥" },
      { name: "Supernova", min: 1000, icon: "🌟" },
    ];
    return NextResponse.json({ levels });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
