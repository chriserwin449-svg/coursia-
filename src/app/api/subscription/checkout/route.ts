import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function getCreemBaseUrl(): string {
  const apiKey = process.env.CREEM_API_KEY || "";
  if (apiKey.startsWith("creem_test_")) {
    return "https://test-api.creem.io/v1";
  }
  return "https://api.creem.io/v1";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, email, userId } = body;

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
      console.error("[checkout] Product ID not configured");
      return NextResponse.json({ error: "Product ID not configured" }, { status: 500 });
    }

    // Fetch user email from DB if not provided
    let customerEmail = email;
    if (!customerEmail) {
      try {
        const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
        customerEmail = user?.email;
      } catch (dbErr) {
        console.warn("[checkout] Could not fetch user email:", dbErr);
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://coursia-8oi4.vercel.app";
    const successUrl = `${appUrl}/?payment=success`;
    const creemBase = getCreemBaseUrl();

    console.log("[checkout] Creating checkout:", {
      plan,
      productId,
      creemBase,
      successUrl,
      hasEmail: !!customerEmail,
    });

    const res = await fetch(`${creemBase}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: successUrl,
        customer: customerEmail ? { email: customerEmail } : undefined,
        metadata: {
          userId,
          plan,
          appSource: "coursia",
        },
      }),
    });

    const data = await res.json();

    console.log("[checkout] Creem response:", {
      status: res.status,
      ok: res.ok,
      id: data.id,
      hasCheckoutUrl: !!data.checkout_url,
      error: data.error,
      mode: data.mode,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: Array.isArray(data.message) ? data.message.join(", ") : (data.error || data.message || "Checkout creation failed"),
        },
        { status: res.status }
      );
    }

    if (!data.checkout_url) {
      return NextResponse.json(
        { error: "No checkout URL returned from Creem" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: data.checkout_url,
      checkoutId: data.id,
    });
  } catch (error) {
    console.error("[checkout] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
