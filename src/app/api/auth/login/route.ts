import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SUPABASE_URL = "https://vbsrliluwytuyulpvflr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic3JsaWx1d3l0dXl1bHB2ZmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkzMjIsImV4cCI6MjA5NTM4NTMyMn0.YMQGLksgpK3aB5xCE8vjmb_-YCfgJO4nTdS13FbQsA4";

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
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/**
 * POST /api/auth/login
 */
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

    // Sign in via Supabase Auth REST API
    const result = await supabaseSignIn(emailLower, password);

    if (result.error || !result.access_token) {
      console.error("Login error:", result);

      if (result.error === "Invalid login credentials" || result.error_code === "invalid_credentials") {
        // Check if user exists in Supabase but password is wrong
        return NextResponse.json({ error: "wrong_password" }, { status: 401 });
      }

      if (result.msg?.includes("Email not confirmed") || result.error === "Email not confirmed") {
        return NextResponse.json({ error: "email_not_confirmed" }, { status: 403 });
      }

      return NextResponse.json({ error: result.msg || result.error || "Identifiants invalides" }, { status: 401 });
    }

    const userId = result.user?.id;
    const metadata = result.user?.user_metadata || {};

    if (!userId) {
      return NextResponse.json({ error: "Erreur lors de la connexion" }, { status: 500 });
    }

    // Sync user to our database
    try {
      await db.user.upsert({
        where: { id: userId },
        update: {
          email: emailLower,
          firstName: metadata.firstName || metadata.first_name || "User",
          lastName: metadata.lastName || metadata.last_name || "",
        },
        create: {
          id: userId,
          email: emailLower,
          password: "managed-by-supabase",
          firstName: metadata.firstName || metadata.first_name || "User",
          lastName: metadata.lastName || metadata.last_name || "",
        },
      });
    } catch (dbError) {
      console.error("DB upsert (non-blocking):", dbError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: emailLower,
        firstName: metadata.firstName || metadata.first_name || "User",
        lastName: metadata.lastName || metadata.last_name || "",
      },
      token: result.access_token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Erreur lors de la connexion" }, { status: 500 });
  }
}
