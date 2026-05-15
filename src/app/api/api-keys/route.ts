import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { key, name } = await request.json();
    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const existing = await db.apiKey.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await db.apiKey.update({
        where: { id: existing.id },
        data: { key, name: name || "default" },
      });
      return NextResponse.json({ success: true });
    }

    await db.apiKey.create({
      data: {
        key,
        name: name || "default",
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api-keys] Error:", error);
    return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const apiKey = await db.apiKey.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!apiKey) {
      return NextResponse.json({ hasKey: false });
    }
    const maskedKey = apiKey.key.slice(0, 6) + "..." + apiKey.key.slice(-4);
    return NextResponse.json({ hasKey: true, name: apiKey.name, keyPreview: maskedKey });
  } catch {
    return NextResponse.json({ hasKey: false });
  }
}
