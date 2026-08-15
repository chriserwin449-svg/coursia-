import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/debug-redirect
 * Returns the redirect_uri that would be used for Google OAuth
 * based on the incoming request headers. This helps debug
 * what URI needs to be registered in Google Cloud Console.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID ? "SET ✓" : "MISSING ✗";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ? "SET ✓" : "MISSING ✗";
  const nextauthUrl = process.env.NEXTAUTH_URL || "(not set)";

  const host = request.headers.get("host") || "(none)";
  const origin = request.headers.get("origin") || "(none)";
  const referer = request.headers.get("referer") || "(none)";
  const forwardedHost = request.headers.get("x-forwarded-host") || "(none)";
  const forwardedProto = request.headers.get("x-forwarded-proto") || "(none)";
  const forwardedFor = request.headers.get("x-forwarded-for") || "(none)";

  // Calculate what redirect_uri would be used
  let redirectUri: string;
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    redirectUri = `${proto}://${forwardedHost.replace(/:\d+$/, "")}/api/auth/google-callback`;
  } else if (origin && origin !== "(none)") {
    redirectUri = `${origin}/api/auth/google-callback`;
  } else {
    const baseUrl = nextauthUrl || `http://${host.replace(/:\d+$/, "")}`;
    redirectUri = `${baseUrl}/api/auth/google-callback`;
  }

  return NextResponse.json({
    message: "Google OAuth Debug Info",
    requiredRedirectUri: redirectUri,
    googleCloudConsoleAction: `Add this URL to Google Cloud Console → APIs & Services → Credentials → Your OAuth Client → Authorized Redirect URIs: ${redirectUri}`,
    env: {
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: clientSecret,
      NEXTAUTH_URL: nextauthUrl,
    },
    headers: {
      host,
      origin,
      referer,
      "x-forwarded-host": forwardedHost,
      "x-forwarded-proto": forwardedProto,
      "x-forwarded-for": forwardedFor,
    },
    note: "When a user clicks 'Continue with Google', the browser sends window.location.origin as the baseUrl. The redirect_uri MUST match exactly what is registered in Google Cloud Console.",
  });
}
