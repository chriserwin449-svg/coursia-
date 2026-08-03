import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/posthog-public-key
 * Returns only the PostHog key and host needed by the client SDK.
 * No auth required — the key is a public-facing write key (not a secret).
 */
export async function GET() {
  try {
    // Check env first (higher priority)
    const envKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const envHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (envKey && envKey !== "phc_YOUR_KEY_HERE") {
      return NextResponse.json({ key: envKey, host: envHost || "https://us.i.posthog.com" });
    }

    // Fall back to database
    let settings: Record<string, unknown> | null = null;
    try {
      settings = await db.appSettings.findUnique({
        where: { id: "main" },
        select: { posthogKey: true, posthogHost: true },
      }) as unknown as Record<string, unknown>;
    } catch {
      try {
        const rows = await db.$queryRawUnsafe(
          `SELECT "posthogKey", "posthogHost" FROM "AppSettings" WHERE id = 'main' LIMIT 1`
        ) as Array<Record<string, unknown>>;
        settings = rows[0] || null;
      } catch {
        // ignore
      }
    }

    const key = (settings?.posthogKey as string) || null;
    const host = (settings?.posthogHost as string) || "https://us.i.posthog.com";

    if (key && key.startsWith("phc_")) {
      return NextResponse.json({ key, host });
    }

    return NextResponse.json({ key: null, host: null });
  } catch {
    return NextResponse.json({ key: null, host: null });
  }
}
