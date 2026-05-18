import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/openai";

export async function GET() {
  try {
    const provider = await getActiveProvider();
    return NextResponse.json({
      status: "ok",
      provider: provider.provider,
      label: provider.label,
      isFree: provider.isFree,
      hasApiKey: provider.hasApiKey,
    });
  } catch (error) {
    console.error("AI status check error:", error);
    return NextResponse.json({
      status: "error",
      provider: "none",
      label: "Error",
      isFree: true,
      hasApiKey: false,
    });
  }
}
