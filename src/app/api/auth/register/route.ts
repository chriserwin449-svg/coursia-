import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SUPABASE_URL = "https://vbsrliluwytuyulpvflr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic3JsaWx1d3l0dXl1bHB2ZmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkzMjIsImV4cCI6MjA5NTM4NTMyMn0.YMQGLksgpK3aB5xCE8vjmb_-YCfgJO4nTdS13FbQsA4";

/**
 * Custom Supabase Auth: direct REST API calls, no client SDK issues.
 */
async function supabaseSignup(email: string, password: string, metadata: Record<string, string>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, data: metadata }),
  });
  return res.json();
}

async function supabaseSignIn(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function supabaseVerifyUser(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
    },
  });
  return { ok: res.ok, data: await res.json() };
}

/**
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Tous les champs sont requis / All fields are required" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email invalide / Invalid email" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const first = firstName.trim();
    const last = lastName.trim();

    // Step 1: Check if user already exists by trying sign in first
    const existingSignin = await supabaseSignIn(emailLower, password);
    if (existingSignin.access_token) {
      // User exists and password matches — just log them in
      const userId = existingSignin.user?.id;
      if (userId) {
        try {
          await db.user.upsert({
            where: { id: userId },
            update: { email: emailLower, firstName: first, lastName: last },
            create: { id: userId, email: emailLower, password: "managed-by-supabase", firstName: first, lastName: last },
          });
        } catch {}

        return NextResponse.json({
          success: true,
          user: { id: userId, email: emailLower, firstName: first, lastName: last },
          token: existingSignin.access_token,
        });
      }
    }

    // Step 2: Create user in Supabase Auth
    const signUpResult = await supabaseSignup(emailLower, password, { firstName: first, lastName: last });

    if (signUpResult.error) {
      if (
        signUpResult.msg?.includes("already registered") ||
        signUpResult.msg?.includes("already exists") ||
        signUpResult.error_code === "user_already_exists"
      ) {
        return NextResponse.json(
          { error: "Un compte existe déjà avec cet email / An account already exists with this email" },
          { status: 409 },
        );
      }
      console.error("Signup error:", signUpResult);
      return NextResponse.json({ error: signUpResult.msg || "Erreur lors de l'inscription" }, { status: 400 });
    }

    const userId = signUpResult.id;
    if (!userId) {
      return NextResponse.json({ error: "Erreur lors de la création du compte" }, { status: 500 });
    }

    // Step 3: Immediately sign in to get token (works even if email not confirmed)
    let accessToken: string | null = null;

    // Retry sign-in a few times with delays (Supabase may take a moment)
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 600));

      const signInResult = await supabaseSignIn(emailLower, password);
      if (signInResult.access_token) {
        accessToken = signInResult.access_token;
        break;
      }
      // Continue retrying...
    }

    // Step 4: Save to our database
    try {
      await db.user.upsert({
        where: { id: userId },
        update: { email: emailLower, firstName: first, lastName: last },
        create: { id: userId, email: emailLower, password: "managed-by-supabase", firstName: first, lastName: last },
      });
    } catch (dbError) {
      console.error("DB upsert (non-blocking):", dbError);
    }

    if (accessToken) {
      return NextResponse.json({
        success: true,
        user: { id: userId, email: emailLower, firstName: first, lastName: last },
        token: accessToken,
      });
    }

    // If we still don't have a token, email confirmation is blocking
    return NextResponse.json({
      success: false,
      user: { id: userId, email: emailLower, firstName: first, lastName: last },
      token: null,
      needsEmailConfirmation: true,
      error: "La confirmation par email est activée dans Supabase. Désactive-la dans Authentication → Email → Confirm email → OFF",
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 });
  }
}
