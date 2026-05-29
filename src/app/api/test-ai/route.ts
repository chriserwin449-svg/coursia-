import { NextResponse } from "next/server";
import { smartChatCompletion, getActiveProvider } from "@/lib/openai";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check which provider is active
  try {
    const provider = await getActiveProvider();
    results.provider = provider;
  } catch (e) {
    results.providerError = e instanceof Error ? e.message : String(e);
  }

  // 2. Check env vars (masked)
  results.OPENAI_API_KEY = process.env.OPENAI_API_KEY
    ? `${process.env.OPENAI_API_KEY.slice(0, 8)}...${process.env.OPENAI_API_KEY.slice(-4)}`
    : "NOT SET";
  results.ZAI_BASE_URL = process.env.ZAI_BASE_URL ? "SET" : "NOT SET";
  results.ZAI_API_KEY = process.env.ZAI_API_KEY ? "SET" : "NOT SET";
  results.DATABASE_URL = process.env.DATABASE_URL ? "SET" : "NOT SET";

  // 3. Test AI call with a simple prompt
  try {
    const completion = await smartChatCompletion([
      {
        role: "system",
        content: 'You MUST respond ONLY with valid JSON. No text before or after. Example: {"status":"ok","message":"hello"}',
      },
      {
        role: "user",
        content: "Return JSON: {\"status\":\"ok\"}",
      },
    ], { maxTokens: 100 });

    results.aiResponse = {
      content: completion.content ? `${completion.content.slice(0, 500)}` : "EMPTY",
      provider: completion.provider,
      length: completion.content?.length || 0,
    };
  } catch (e) {
    results.aiError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
