import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/auth/google-signin
 * Direct redirect to Google OAuth — skips NextAuth's intermediate page.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[google-signin] GOOGLE_CLIENT_ID is not set. Env keys:", Object.keys(process.env).filter(k => k.includes("GOOGLE") || k.includes("NEXTAUTH")));
    return NextResponse.json({ error: "Google OAuth non configuré" }, { status: 500 });
  }

  // Build base URL:
  // 1. If behind a reverse proxy (Caddy), use forwarded headers for the external URL
  // 2. Otherwise fall back to NEXTAUTH_URL or localhost
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  
  // Check if we're behind a proxy (forwarded host differs from direct access)
  const directHost = request.headers.get("host") || "localhost:3000";
  const hasForwardedHeaders = request.headers.get("x-forwarded-host") !== null;
  
  let baseUrl: string;
  if (hasForwardedHeaders && request.headers.get("x-forwarded-host") !== directHost) {
    // Behind a reverse proxy — use the external URL
    const host = forwardedHost.replace(/:\d+$/, "");
    baseUrl = `${forwardedProto}://${host}`;
  } else {
    // Direct access or no proxy — use NEXTAUTH_URL
    baseUrl = process.env.NEXTAUTH_URL || `http://${directHost.replace(/:\d+$/, "")}`;
  }
  
  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  console.log("[google-signin] redirect_uri:", redirectUri, "| host:", directHost, "| forwarded:", forwardedHost, "| proto:", forwardedProto);

  const state = crypto.randomBytes(32).toString("hex");

  const googleUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account",
    }).toString();

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
