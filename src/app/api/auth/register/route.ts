import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";

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
      return NextResponse.json(
        { error: "Email invalide / Invalid email" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères / Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: { firstName: firstName.trim(), lastName: lastName.trim() },
        emailRedirectTo: undefined,
      },
    });

    if (authError) {
      console.error("Supabase signup error:", authError.message);
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        return NextResponse.json(
          { error: "Un compte existe déjà avec cet email / An account already exists with this email" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 },
      );
    }

    const supabaseUserId = authData.user?.id;
    const accessToken = authData.session?.access_token;

    if (!supabaseUserId) {
      return NextResponse.json(
        { error: "Erreur lors de la création du compte" },
        { status: 500 },
      );
    }

    // Create/update our User record in database (for app-specific data)
    try {
      await db.user.upsert({
        where: { id: supabaseUserId },
        update: {
          email: email.toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
        create: {
          id: supabaseUserId,
          email: email.toLowerCase(),
          password: "managed-by-supabase",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
      });
    } catch (dbError) {
      console.error("DB upsert error (non-blocking):", dbError);
      // Non-blocking: auth worked, just DB sync failed
    }

    return NextResponse.json({
      success: true,
      user: {
        id: supabaseUserId,
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
      token: accessToken || null,
      needsConfirmation: !authData.session,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'inscription / Registration failed" },
      { status: 500 },
    );
  }
}
