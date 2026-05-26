import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis / Email and password required" },
        { status: 400 },
      );
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (authError) {
      console.error("Supabase login error:", authError.message);
      if (authError.message.includes("Invalid login") || authError.message.includes("Invalid credentials")) {
        return NextResponse.json(
          { error: "wrong_password" },
          { status: 401 },
        );
      }
      if (authError.message.includes("Email not confirmed")) {
        return NextResponse.json(
          { error: "email_not_confirmed" },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 401 },
      );
    }

    const userId = authData.user?.id;
    const accessToken = authData.session?.access_token;

    if (!userId) {
      return NextResponse.json(
        { error: "Erreur lors de la connexion" },
        { status: 500 },
      );
    }

    // Ensure user exists in our database
    try {
      await db.user.upsert({
        where: { id: userId },
        update: {
          email: email.toLowerCase(),
          firstName: authData.user.user_metadata?.firstName || authData.user.user_metadata?.first_name || "User",
          lastName: authData.user.user_metadata?.lastName || authData.user.user_metadata?.last_name || "",
        },
        create: {
          id: userId,
          email: email.toLowerCase(),
          password: "managed-by-supabase",
          firstName: authData.user.user_metadata?.firstName || authData.user.user_metadata?.first_name || "User",
          lastName: authData.user.user_metadata?.lastName || authData.user.user_metadata?.last_name || "",
        },
      });
    } catch (dbError) {
      console.error("DB upsert error (non-blocking):", dbError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: email.toLowerCase(),
        firstName: authData.user.user_metadata?.firstName || authData.user.user_metadata?.first_name || "User",
        lastName: authData.user.user_metadata?.lastName || authData.user.user_metadata?.last_name || "",
      },
      token: accessToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion / Login failed" },
      { status: 500 },
    );
  }
}
