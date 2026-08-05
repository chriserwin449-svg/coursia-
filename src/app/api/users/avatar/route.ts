import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/users/avatar
 * Uploads a profile avatar image.
 * Accepts multipart/form-data with field "avatar" (file) and "userId" (string).
 *
 * The avatar is stored as a base64 data URI in the database so it works
 * on any deployment (Vercel, local, etc.) without needing persistent file storage.
 * Max file size: 2MB (client should compress before sending).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;
    const userId = formData.get("userId") as string | null;

    console.log(`[avatar] Upload request — userId: ${userId?.substring(0, 8)}..., file: ${file?.name}, size: ${file?.size}, type: ${file?.type}`);

    if (!userId) {
      console.error("[avatar] ❌ Missing userId");
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!file) {
      console.error("[avatar] ❌ No file provided");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      console.error(`[avatar] ❌ Invalid file type: ${file.type}`);
      return NextResponse.json(
        { error: "Format non supporté. Utilise JPEG, PNG ou WebP." },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      console.error(`[avatar] ❌ File too large: ${file.size} bytes`);
      return NextResponse.json(
        { error: "Fichier trop volumineux. Max 2 Mo." },
        { status: 400 }
      );
    }

    // Convert file to base64 data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    const avatarUrl = `data:${file.type};base64,${base64}`;

    console.log(`[avatar] Base64 length: ${Math.round(base64.length / 1024)}KB, updating DB...`);

    // Ensure avatar column exists (for PostgreSQL compatibility)
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl.includes("postgres")) {
      try {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "avatar" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;`
        );
      } catch { /* non-critical */ }
    }

    // Update user's avatar in database
    try {
      await db.user.update({
        where: { id: userId },
        data: { avatar: avatarUrl },
      });
      console.log(`[avatar] ✅ Prisma update successful for user ${userId.substring(0, 8)}`);
    } catch (dbError) {
      console.error("[avatar] ❌ Prisma update failed, trying raw SQL:", dbError);
      // Fallback to raw SQL
      try {
        const dbUrl = process.env.DATABASE_URL || "";
        if (dbUrl.includes("postgres")) {
          await db.$executeRawUnsafe(
            `UPDATE "User" SET "avatar" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
            avatarUrl,
            userId
          );
        } else {
          await db.$executeRawUnsafe(
            `UPDATE "User" SET "avatar" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
            avatarUrl,
            userId
          );
        }
        console.log(`[avatar] ✅ Raw SQL update successful for user ${userId.substring(0, 8)}`);
      } catch (rawError) {
        console.error("[avatar] ❌ Raw SQL update also failed:", rawError);
        return NextResponse.json(
          { error: "Impossible de sauvegarder l'avatar." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    console.error("[avatar] ❌ Fatal upload error:", error);
    return NextResponse.json(
      { error: "Erreur lors du téléchargement." },
      { status: 500 }
    );
  }
}
