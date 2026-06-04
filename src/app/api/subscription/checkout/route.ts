import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CREEM_API_BASE = process.env.CREEM_API_BASE_URL || "https://api.creem.io/v1";

export async function POST(request: NextRequest) {
  try {
    const { plan, email, userId } = await request.json();

    if (!plan || !["monthly", "annual"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      console.error("[checkout] CREEM_API_KEY not set");
      return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
    }

    const productId =
      plan === "annual"
        ? process.env.CREEM_ANNUAL_PRODUCT_ID
        : process.env.CREEM_MONTHLY_PRODUCT_ID;

    if (!productId) {
      return NextResponse.json({ error: "Product ID not configured" }, { status: 500 });
    }

    // Fetch user email from DB if not provided
    let customerEmail = email;
    if (!customerEmail) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      customerEmail = user?.email;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coursia-8oi4.vercel.app";

    const res = await fetch(`${CREEM_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: `${appUrl}?checkout=success&plan=${plan}`,
        cancel_url: `${appUrl}?checkout=cancel`,
        customer: customerEmail ? { email: customerEmail } : undefined,
        metadata: {
          userId,
          plan,
          appSource: "coursia",
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[checkout] Creem API error:", data);
      return NextResponse.json(
        { error: data.message || "Checkout creation failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: data.checkout_url,
      checkoutId: data.id,
    });
  } catch (error) {
    console.error("[checkout] Error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
