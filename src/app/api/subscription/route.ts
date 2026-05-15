import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ plan: "free", status: "active" });
}
