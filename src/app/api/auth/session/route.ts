import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/auth/session
 * Returns the current NextAuth session (used after Google OAuth to extract user info).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error("[auth-session] Error:", error);
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}
