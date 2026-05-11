import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requis / Token required" }, { status: 400 });
    }

    // In a simple token system, we just validate the token exists in localStorage
    // The actual session validation is done client-side
    // For a production app, this would validate against a session store or JWT

    return NextResponse.json({ valid: true });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
