import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SUPABASE_URL = "https://vbsrliluwytuyulpvflr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic3JsaWx1d3l0dXl1bHB2ZmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkzMjIsImV4cCI6MjA5NTM4NTMyMn0.YMQGLksgpK3aB5xCE8vjmb_-YCfgJO4nTdS13FbQsA4";

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
 * POST: verify token + userId from body
 */
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();
    if (!token || !userId) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const { ok, data } = await supabaseVerifyUser(token);
    if (!ok || data.id !== userId) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return await buildResponse(userId, data);
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

/**
 * GET: verify token from Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const { ok, data } = await supabaseVerifyUser(authHeader.substring(7));
    if (!ok) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return await buildResponse(data.id, data);
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

async function buildResponse(userId: string, authUser: Record<string, unknown>) {
  const metadata = (authUser.user_metadata as Record<string, string>) || {};

  let user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = {
      id: userId,
      email: (authUser.email as string) || "",
      firstName: metadata.firstName || metadata.first_name || "User",
      lastName: metadata.lastName || metadata.last_name || "",
      password: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return NextResponse.json({
    valid: true,
    hasSubscription: false,
    user: { id: userId, email: user.email, firstName: user.firstName, lastName: user.lastName },
  });
}
