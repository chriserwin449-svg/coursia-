import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const certificates = await db.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        courseTitle: true,
        certificateId: true,
        issuedAt: true,
        score: true,
        totalLevels: true,
      },
    });

    return NextResponse.json({ certificates });
  } catch (error) {
    console.error("[certificates] Error:", error);
    return NextResponse.json({ error: "Failed to fetch certificates" }, { status: 500 });
  }
}
