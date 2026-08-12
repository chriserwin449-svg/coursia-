import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/google-me
 * Reads the google_auth_data cookie set by /api/auth/google-callback
 * and returns the user + token to the client.
 * Clears the cookie after reading (one-time use).
 */
export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get("google_auth_data");

    if (!cookie?.value) {
      return NextResponse.json({ error: "No Google auth data found" }, { status: 401 });
    }

    const jsonStr = Buffer.from(cookie.value, "base64").toString("utf-8");
    const data = JSON.parse(jsonStr);

    if (!data.user || !data.token) {
      return NextResponse.json({ error: "Invalid auth data" }, { status: 401 });
    }

    const response = NextResponse.json({
      user: data.user,
      token: data.token,
      isNewUser: data.isNewUser || false,
    });

    // Clear the one-time cookie
    response.cookies.delete("google_auth_data");

    return response;
  } catch (error) {
    console.error("[google-me] Error:", error);
    return NextResponse.json({ error: "Failed to read Google auth data" }, { status: 500 });
  }
}
