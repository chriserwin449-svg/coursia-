import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json();
    // Placeholder for Lemon Squeezy checkout integration
    return NextResponse.json({
      success: true,
      message: "Checkout integration not yet configured. Add LEMON_SQUEEZY_API_KEY to .env",
      checkoutUrl: "#",
    });
  } catch (error) {
    console.error("[checkout] Error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
