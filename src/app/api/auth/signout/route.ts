import { NextResponse } from "next/server";

export async function POST() {
  // Token-based auth: client simply clears the token from localStorage.
  // No server-side session to invalidate.
  return NextResponse.json({ success: true });
}
