import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/posthog-config
 * Returns the PostHog configuration (key + host) stored in AppSettings.
 * The key is partially masked for security.
 */
export async function GET() {
  try {
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
    const host = (settings?.posthogHost as string) || null;

    // Mask the key for security (show first 8 chars + last 4)
    const maskedKey = key && key.startsWith("phc_")
      ? key.substring(0, 12) + "••••••••" + key.substring(key.length - 4)
      : key;

    return NextResponse.json({
      configured: !!key && key.startsWith("phc_"),
      key: maskedKey,
      host: host || "https://us.i.posthog.com",
    });
  } catch (error) {
    console.error("[posthog-config] GET error:", error);
    return NextResponse.json({ configured: false, key: null, host: null }, { status: 500 });
  }
}

/**
 * POST /api/admin/posthog-config
 * Saves the PostHog API key and host to AppSettings.
 * Body: { key: string, host?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { key, host } = await request.json();

    if (!key || typeof key !== "string" || !key.startsWith("phc_")) {
      return NextResponse.json(
        { error: "Invalid key. Must start with phc_" },
        { status: 400 }
      );
    }

    const posthogHost = (host && typeof host === "string")
      ? host
      : "https://us.i.posthog.com";

    // Save to database
    try {
      await db.appSettings.upsert({
        where: { id: "main" },
        update: { posthogKey: key, posthogHost },
        create: { id: "main", posthogKey: key, posthogHost },
      });
    } catch {
      try {
        await db.$executeRawUnsafe(
          `INSERT INTO "AppSettings" ("id", "posthogKey", "posthogHost", "updatedAt")
           VALUES ('main', $1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT("id") DO UPDATE SET "posthogKey" = $1, "posthogHost" = $2, "updatedAt" = CURRENT_TIMESTAMP`,
          key, posthogHost
        );
      } catch (err) {
        console.error("[posthog-config] Fallback upsert failed:", err);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "PostHog configuration saved. Reload the page to activate.",
    });
  } catch (error) {
    console.error("[posthog-config] POST error:", error);
    return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/posthog-config
 * Removes the PostHog configuration (disconnects analytics).
 */
export async function DELETE() {
  try {
    try {
      await db.appSettings.update({
        where: { id: "main" },
        data: { posthogKey: null, posthogHost: null },
      });
    } catch {
      try {
        await db.$executeRawUnsafe(
          `UPDATE "AppSettings" SET "posthogKey" = NULL, "posthogHost" = NULL WHERE id = 'main'`
        );
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ success: true, message: "PostHog configuration removed." });
  } catch (error) {
    console.error("[posthog-config] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove configuration" }, { status: 500 });
  }
}
