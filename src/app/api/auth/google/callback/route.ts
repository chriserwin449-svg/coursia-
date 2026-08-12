import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * POST /api/auth/google/callback
 * Called after NextAuth Google sign-in completes.
 * Creates or links the user in our database, returns our custom auth token.
 *
 * Body: { email, name, given_name, family_name, picture, googleId }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, name, given_name, family_name, picture, googleId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const firstName = (given_name || name?.split(" ")[0] || "").trim();
    const lastName = (family_name || name?.split(" ").slice(1).join(" ") || "").trim();

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await db.$queryRawUnsafe(
        `SELECT "id", "email", "firstName", "lastName", "avatar" FROM "User" WHERE "email" = $1 LIMIT 1`,
        emailLower
      ) as Array<{ id: string; email: string; firstName: string; lastName: string; avatar: string | null }>;
    } catch (err) {
      console.error("[google-callback] User lookup error:", err);
      // Fallback without avatar column
      try {
        existingUser = await db.$queryRawUnsafe(
          `SELECT "id", "email", "firstName", "lastName" FROM "User" WHERE "email" = $1 LIMIT 1`,
          emailLower
        ) as Array<{ id: string; email: string; firstName: string; lastName: string; avatar: string | null }>;
      } catch { /* ignore */ }
    }

    const user = existingUser?.[0] || null;

    if (user) {
      // User exists — log them in
      // Optionally update avatar from Google
      if (picture && !user.avatar) {
        try {
          await db.$executeRawUnsafe(
            `UPDATE "User" SET "avatar" = $1, "updatedAt" = datetime('now') WHERE "id" = $2`,
            picture, user.id
          );
        } catch { /* ignore */ }
      }

      const token = generateToken(user.id);
      console.log(`✅ [google-callback] Existing user logged in: ${emailLower}`);

      return NextResponse.json({
        success: true,
        isNewUser: false,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: picture || user.avatar || null,
        },
        token,
      });
    }

    // New user — create account with random password (Google-only account)
    const userId = crypto.randomUUID();
    const randomPassword = crypto.randomBytes(32).toString("hex");

    // Hash the random password
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.default.hash(randomPassword, 12);

    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "avatar", "subscriptionPlan", "subscriptionStatus", "freeCourseUsed", "hasCardOnFile", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'free', 'none', false, false, datetime('now'), datetime('now'))`,
        userId, emailLower, hashedPassword, firstName || "Google", lastName || "User", picture || null
      );

      // Create AppSettings entry
      try {
        await db.$executeRawUnsafe(
          `INSERT INTO "AppSettings" ("id", "flamePoints", "updatedAt")
           VALUES ($1, 0, datetime('now'))
           ON CONFLICT ("id") DO NOTHING`,
          userId
        );
      } catch { /* non-critical */ }

      const token = generateToken(userId);
      console.log(`✅ [google-callback] New user created via Google: ${emailLower}`);

      return NextResponse.json({
        success: true,
        isNewUser: true,
        user: {
          id: userId,
          email: emailLower,
          firstName: firstName || "Google",
          lastName: lastName || "User",
          avatar: picture || null,
        },
        token,
      });
    } catch (err) {
      console.error("[google-callback] User creation error:", err);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[google-callback] Unhandled error:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }
}
