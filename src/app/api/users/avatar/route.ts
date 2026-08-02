import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * POST /api/users/avatar
 * Uploads a profile avatar image.
 * Accepts multipart/form-data with field "avatar" (file) and "userId" (string).
 * Saves to public/uploads/avatars/ and returns the URL path.
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

    // Read file bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `avatar_${userId}_${Date.now()}.${ext}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // Build URL path (relative to public)
    const avatarUrl = `/uploads/avatars/${filename}`;

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
        await db.$executeRawUnsafe(
          `UPDATE "User" SET "avatar" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
          avatarUrl,
          userId
        );
      } catch (rawError) {
        console.error("[avatar] Raw SQL update also failed:", rawError);
      }
    }

    console.log(`✅ [avatar] Uploaded avatar for user ${userId}: ${avatarUrl}`);

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    console.error("[avatar] Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
