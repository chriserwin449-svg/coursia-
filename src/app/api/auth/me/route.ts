import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

function generateToken(userId: string): string {
  return createHash("sha256").update(userId + "-coursia-token-v1").digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json({ valid: false, error: "Token and userId required" }, { status: 400 });
    }

    // Look up user by ID
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Regenerate the expected token and compare
    const expectedToken = generateToken(user.id);
    if (token !== expectedToken) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Get subscription status
    const settings = await db.appSettings.findUnique({ where: { userId } });
    const hasSubscription = settings?.hasSubscription === true;

    return NextResponse.json({
      valid: true,
      hasSubscription,
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
