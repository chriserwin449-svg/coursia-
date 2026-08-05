import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/users/avatar
 * Uploads a profile avatar image.
 * Accepts multipart/form-data with field "avatar" (file) and "userId" (string).
 *
 * The avatar is stored as a base64 data URI in the database so it works
 * on any deployment (Vercel, local, etc.) without needing persistent file storage.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    // Convert file to base64 data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Determine MIME type from file
    const mimeMap: Record<string, string> = {
      "image/jpeg": "image/jpeg",
      "image/png": "image/png",
      "image/webp": "image/webp",
      "image/gif": "image/gif",
    };
    const mime = mimeMap[file.type] || file.type;
    const avatarUrl = `data:${mime};base64,${base64}`;

    // Update user's avatar in database
    try {
      await db.user.update({
        where: { id: userId },
        data: { avatar: avatarUrl },
      });
    } catch (dbError) {
      console.error("[avatar] DB update failed, trying raw SQL:", dbError);
      // Fallback to raw SQL for compatibility
      try {
        const dbUrl = process.env.DATABASE_URL || "";
        if (dbUrl.startsWith("file:")) {
          // SQLite
          await db.$executeRawUnsafe(
            `UPDATE "User" SET "avatar" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
            avatarUrl,
            userId
          );
        } else {
          // PostgreSQL
          await db.$executeRawUnsafe(
            `UPDATE "User" SET "avatar" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
            avatarUrl,
            userId
          );
        }
      } catch (rawError) {
        console.error("[avatar] Raw SQL update also failed:", rawError);
        return NextResponse.json(
          { error: "Failed to save avatar to database" },
          { status: 500 }
        );
      }
    }

    console.log(`✅ [avatar] Uploaded avatar for user ${userId} (base64, ${Math.round(base64.length / 1024)}KB)`);

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    console.error("[avatar] Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
