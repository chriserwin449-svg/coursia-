import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/openai";

export async function GET() {
  const provider = await getActiveProvider();
  return NextResponse.json({
    status: "ok",
    provider: provider.provider,
    label: provider.label,
    isFree: provider.isFree,
    hasApiKey: provider.hasApiKey,
  });
}
