import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

function generateToken(userId: string): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * GET /api/auth/google-callback
 * Handles the redirect back from Google after user authorizes.
 * 1. Verifies state cookie
 * 2. Exchanges code for tokens
 * 3. Gets user info from Google
 * 4. Creates or finds user in our DB
 * 5. Stores auth data in a short-lived cookie
 * 6. Redirects to /?googleAuth=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Detect return URL from request host (what the user's browser will accept)
    const requestHost = request.headers.get("host") || "localhost";
    const requestProto = request.headers.get("x-forwarded-proto") || "http";
    const returnBase = `${requestProto}://${requestHost.replace(/:\d+$/, "")}`;

    if (error) {
      console.error("[google-callback] Google error:", error);
      return NextResponse.redirect(`${returnBase}/?googleError=${encodeURIComponent(error)}`);
    }

    // Verify state
    const storedState = request.cookies.get("google_oauth_state")?.value;
    if (!code || !state || state !== storedState) {
      console.error("[google-callback] State mismatch. Stored:", storedState?.substring(0, 8), "Got:", state?.substring(0, 8));
      return NextResponse.redirect(`${returnBase}/?googleError=invalid_state`);
    }

    // Build redirect_uri for token exchange — must match what was used in signin
    // Priority: X-Forwarded-Host > NEXTAUTH_URL > request host
    const forwardedHost = request.headers.get("x-forwarded-host");
    let tokenExchangeBase: string;
    if (forwardedHost) {
      const proto = request.headers.get("x-forwarded-proto") || "https";
      tokenExchangeBase = `${proto}://${forwardedHost.replace(/:\d+$/, "")}`;
    } else {
      tokenExchangeBase = process.env.NEXTAUTH_URL || returnBase;
    }

    const redirectUri = `${tokenExchangeBase}/api/auth/google-callback`;
    console.log("[google-callback] Token exchange redirect_uri:", redirectUri, "| returnBase:", returnBase);

    // Exchange code for access token
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    if (!clientId || !clientSecret) {
      console.error("[google-callback] Missing Google credentials");
      return NextResponse.redirect(`${returnBase}/?googleError=not_configured`);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error("[google-callback] Token exchange failed:", JSON.stringify(tokens));
      return NextResponse.redirect(`${returnBase}/?googleError=token_failed`);
    }

    // Get user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await userRes.json();

    if (!gUser.email) {
      console.error("[google-callback] No email from Google");
      return NextResponse.redirect(`${returnBase}/?googleError=no_email`);
    }

    const emailLower = gUser.email.toLowerCase().trim();
    const firstName = (gUser.given_name || gUser.name?.split(" ")[0] || "").trim();
    const lastName = (gUser.family_name || gUser.name?.split(" ").slice(1).join(" ") || "").trim();
    const picture = gUser.picture || null;

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await db.$queryRawUnsafe(
        `SELECT "id", "email", "firstName", "lastName", "avatar" FROM "User" WHERE "email" = $1 LIMIT 1`,
        emailLower
      ) as Array<{ id: string; email: string; firstName: string; lastName: string; avatar: string | null }>;
    } catch {
      try {
        existingUser = await db.$queryRawUnsafe(
          `SELECT "id", "email", "firstName", "lastName" FROM "User" WHERE "email" = $1 LIMIT 1`,
          emailLower
        ) as Array<{ id: string; email: string; firstName: string; lastName: string; avatar: string | null }>;
      } catch { /* ignore */ }
    }

    const user = existingUser?.[0] || null;

    let userId: string;
    let isNewUser = false;

    if (user) {
      userId = user.id;
      // Update avatar from Google if missing
      if (picture && !user.avatar) {
        try {
          await db.$executeRawUnsafe(
            `UPDATE "User" SET "avatar" = $1, "updatedAt" = datetime('now') WHERE "id" = $2`,
            picture, user.id
          );
        } catch { /* ignore */ }
      }
      console.log(`✅ [google-callback] Existing user logged in: ${emailLower}`);
    } else {
      // Create new user
      isNewUser = true;
      userId = crypto.randomUUID();
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.default.hash(randomPassword, 12);

      try {
        await db.$executeRawUnsafe(
          `INSERT INTO "User" ("id", "email", "password", "firstName", "lastName", "avatar", "subscriptionPlan", "subscriptionStatus", "freeCourseUsed", "hasCardOnFile", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'free', 'none', false, false, datetime('now'), datetime('now'))`,
          userId, emailLower, hashedPassword, firstName || "Google", lastName || "User", picture
        );

        try {
          await db.$executeRawUnsafe(
            `INSERT INTO "AppSettings" ("id", "flamePoints", "updatedAt") VALUES ($1, 0, datetime('now')) ON CONFLICT ("id") DO NOTHING`,
            userId
          );
        } catch { /* non-critical */ }

        console.log(`✅ [google-callback] New user created via Google: ${emailLower}`);
      } catch (err) {
        console.error("[google-callback] User creation error:", err);
        return NextResponse.redirect(`${returnBase}/?googleError=create_failed`);
      }
    }

    // Generate our custom auth token
    const token = generateToken(userId);

    // Store auth data in a short-lived cookie for the client to pick up
    const authPayload = JSON.stringify({
      user: {
        id: userId,
        email: emailLower,
        firstName: firstName || (user?.firstName) || "Google",
        lastName: lastName || (user?.lastName) || "User",
        avatar: picture || user?.avatar || null,
      },
      token,
      isNewUser,
    });

    const response = NextResponse.redirect(`${returnBase}/?googleAuth=1`);
    response.cookies.delete("google_oauth_state");
    response.cookies.set("google_auth_data", Buffer.from(authPayload).toString("base64"), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[google-callback] Unhandled error:", error);
    const fallbackUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return NextResponse.redirect(`${fallbackUrl}/?googleError=server_error`);
  }
}
