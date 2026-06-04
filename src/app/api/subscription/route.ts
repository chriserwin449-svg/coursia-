import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      userId = authHeader.substring(7);
    } else {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get("userId");
    }

    if (!userId) {
      return NextResponse.json({
        plan: "free",
        status: "none",
        hasSubscription: false,
      });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        plan: "free",
        status: "none",
        hasSubscription: false,
      });
    }

    const isActive = user.subscriptionStatus === "active";

    return NextResponse.json({
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      hasSubscription: isActive,
      subscriptionStartDate: user.subscriptionStartDate,
    });
  } catch (error) {
    console.error("[subscription-status] Error:", error);
    return NextResponse.json({ plan: "free", status: "none", hasSubscription: false });
  }
}
