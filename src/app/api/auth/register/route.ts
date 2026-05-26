import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mot de passe trop court (min 6 caractères)" },
        { status: 400 },
      );
    }

    const emailLower = email.toLowerCase().trim();
    const first = firstName.trim();
    const last = lastName.trim();

    // Test DB connection first
    try {
      await db.$queryRaw`SELECT 1 as ok`;
    } catch (dbTestError: unknown) {
      const msg = dbTestError instanceof Error ? dbTestError.message : String(dbTestError);
      console.error("DB connection failed:", msg);
      return NextResponse.json(
        { error: "Base de données indisponible. Réessaie dans quelques instants.", debug: msg },
        { status: 503 },
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.user.create({
      data: {
        email: emailLower,
        password: hashedPassword,
        firstName: first,
        lastName: last,
      },
    });

    // Generate auth token
    const token = generateToken(user.id);

    // Ensure AppSettings entry exists
    try {
      await db.appSettings.upsert({
        where: { id: user.id },
        update: {},
        create: { id: user.id, flamePoints: 0, hasSubscription: false },
      });
    } catch {
      // Non-blocking
    }

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
  } catch (error: unknown) {
    console.error("Register error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription", debug: msg },
      { status: 500 },
    );
  }
}
