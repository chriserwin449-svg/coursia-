import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";

// POST: verify token + userId from body
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();

    if (!token || !userId) {
      return NextResponse.json({ valid: false, error: "Token and userId required" }, { status: 400 });
    }

    // Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    if (authData.user.id !== userId) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return await buildResponse(authData.user.id, authData.user);
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

// GET: verify token from Authorization header
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const token = authHeader.substring(7);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return await buildResponse(authData.user.id, authData.user);
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

async function buildResponse(userId: string, authUser: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  // Get user data from our database
  let user = await db.user.findUnique({ where: { id: userId } });

  // Fallback if user not in our DB yet
  if (!user) {
    user = {
      id: userId,
      email: authUser.email || "",
      firstName: (authUser.user_metadata?.firstName as string) || (authUser.user_metadata?.first_name as string) || "User",
      lastName: (authUser.user_metadata?.lastName as string) || (authUser.user_metadata?.last_name as string) || "",
      password: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return NextResponse.json({
    valid: true,
    hasSubscription: false,
    user: {
      id: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
