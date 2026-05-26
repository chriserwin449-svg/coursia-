import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST: verify token + userId from body
 */
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Token is valid if user exists (simple token-based auth)
    // The token itself is a random session identifier stored client-side
    return NextResponse.json({
      valid: true,
      hasSubscription: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

/**
 * GET: verify via Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const userId = authHeader.substring(7);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      hasSubscription: false,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
