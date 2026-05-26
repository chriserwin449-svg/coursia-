import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Find user
    const user = await db.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    // Check password format (old hash vs new bcrypt)
    let passwordValid = false;

    if (user.password.startsWith("$2") || user.password.startsWith("$2b") || user.password.startsWith("$2a")) {
      // bcrypt hash
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy SHA-256 hash
      const crypto = require("crypto");
      const legacyHash = crypto.createHash("sha256").update(password).update("coursia-salt-2025").digest("hex");
      passwordValid = legacyHash === user.password;

      // If valid, upgrade to bcrypt
      if (passwordValid) {
        const newHash = await bcrypt.hash(password, 12);
        await db.user.update({ where: { id: user.id }, data: { password: newHash } });
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }

    // Generate new auth token
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
      { error: "Erreur lors de la connexion" },
      { status: 500 },
    );
  }
}
