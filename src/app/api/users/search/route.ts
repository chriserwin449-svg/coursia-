import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await db.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
            ],
          },
          { id: { not: userId } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      take: 10,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[users/search] Error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
