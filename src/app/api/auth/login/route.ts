import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).update("coursia-salt-2025").digest("hex");
}

function generateToken(userId: string): string {
  return createHash("sha256").update(userId + "-coursia-token-v1").digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis / Email and password required" },
        { status: 400 },
      );
    }

    // Find user
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 404 },
      );
    }

    // Verify password
    const hashedInput = hashPassword(password);
    if (hashedInput !== user.password) {
      return NextResponse.json(
        { error: "wrong_password" },
        { status: 401 },
      );
    }

    // Create deterministic token (verifiable server-side)
    const token = generateToken(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion / Login failed" },
      { status: 500 },
    );
  }
}
