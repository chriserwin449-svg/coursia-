import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";

// Simple hash function for token (same as login/register)
function hashToken(input: string): string {
  return createHash("sha256").update(input + "coursia-token-secret").digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, picture } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists
    let user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Auto-create account
      user = await db.user.create({
        data: {
          email,
          password: `google_${Date.now()}`,
          firstName: firstName || "",
          lastName: lastName || "",
        },
      });
    }

    // Generate auth token (compatible with existing system)
    const token = hashToken(user.id + "-" + Date.now());

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        picture: picture || null,
      },
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
