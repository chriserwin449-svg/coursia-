import { NextRequest } from "next/server";

/**
 * Extract userId from a NextRequest using multiple strategies:
 * 1. Authorization: Bearer <userId> header
 * 2. ?userId=xxx query parameter
 * 3. Body field (if already parsed and passed)
 *
 * Returns empty string if no userId is found (caller should handle gracefully).
 */
export function getUserIdFromRequest(request: NextRequest, bodyUserId?: string): string {
  return (
    bodyUserId ||
    request.headers.get("Authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("userId") ||
    ""
  );
}