import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getGoogleOAuthCredentials } from "@/lib/google-oauth-config";

/**
 * GET /api/auth/google-signin?baseUrl=<origin>
 *
 * The client passes its `window.location.origin` as `baseUrl` query param.
 * This ensures the redirect_uri matches the external URL the user's browser
 * sees, which is required for Google OAuth to work through reverse proxies.
 */
export async function GET(request: NextRequest) {
  const { clientId } = getGoogleOAuthCredentials();
  if (!clientId) {
    console.error("[google-signin] No GOOGLE_CLIENT_ID available.");
    return NextResponse.json({ error: "Google OAuth non configuré" }, { status: 500 });
  }

  // 1. Use client-provided baseUrl (from query param) — most reliable for external access
  // 2. Fall back to X-Forwarded-Host header
  // 3. Fall back to NEXTAUTH_URL env var
  // 4. Fall back to request Host header
  const { searchParams } = new URL(request.url);
  let baseUrl = searchParams.get("baseUrl") || "";

  if (!baseUrl) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
      const proto = request.headers.get("x-forwarded-proto") || "https";
      baseUrl = `${proto}://${forwardedHost.replace(/:\d+$/, "")}`;
    }
  }

  if (!baseUrl) {
    baseUrl = process.env.NEXTAUTH_URL || "";
  }

  if (!baseUrl) {
    const host = request.headers.get("host") || "localhost:3000";
    baseUrl = `http://${host.replace(/:\d+$/, "")}`;
  }

  // Clean up: remove trailing slash
  baseUrl = baseUrl.replace(/\/+$/, "");

  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  console.log("[google-signin] redirect_uri:", redirectUri);

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
