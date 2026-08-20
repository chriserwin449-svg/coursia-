import { NextResponse } from "next/server";

// Must match the models in callGroq() in openai.ts
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

// gpt-oss-120b is a reasoning model that needs high max_tokens
function getMaxTokensForModel(model: string): number {
  return model.includes('gpt-oss-120b') ? 16384 : 8192;
}

export async function GET() {
  const results: Record<string, unknown> = {};

  // Env vars (masked)
  results.GROQ_API_KEY = process.env.GROQ_API_KEY
    ? `${process.env.GROQ_API_KEY.slice(0, 10)}...${process.env.GROQ_API_KEY.slice(-4)}`
    : "NOT SET";
  results.OPENAI_API_KEY = process.env.OPENAI_API_KEY
    ? `${process.env.OPENAI_API_KEY.slice(0, 10)}...`
    : "NOT SET";
  results.DATABASE_URL = process.env.DATABASE_URL ? "SET" : "NOT SET";

  // Test EACH Groq model individually
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    results.groqTests = {};
    for (const model of GROQ_MODELS) {
      try {
        const maxTokens = getMaxTokensForModel(model);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "Respond ONLY with valid JSON." },
              { role: "user", content: 'Return: {"status":"ok"}' },
            ],
            max_tokens: maxTokens,
          }),
        });

        const text = await response.text();
        let content = "";
        let reasoning = "";
        let finishReason = "";
        let apiError = null;
        try {
          const json = JSON.parse(text);
          const choice = json.choices?.[0];
          content = choice?.message?.content || "";
          reasoning = choice?.message?.reasoning || "";
          finishReason = choice?.finish_reason || "";
          apiError = json.error;
        } catch { /* not JSON */ }

        (results.groqTests as Record<string, unknown>)[model] = {
          status: response.status,
          content: content ? content.slice(0, 200) : "EMPTY",
          reasoning: reasoning ? `${reasoning.length} chars, preview: ${reasoning.slice(0, 150)}...` : "NONE",
          finishReason,
          maxTokensUsed: maxTokens,
          error: apiError,
          responsePreview: text.slice(0, 500),
        };
      } catch (e) {
        (results.groqTests as Record<string, unknown>)[model] = {
          fetchError: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }

  // Test smartChatCompletion (the function used by the app)
  try {
    const { smartChatCompletion, getActiveProvider } = await import("@/lib/openai");
    const provider = await getActiveProvider();
    results.smartProvider = provider;

    const completion = await smartChatCompletion([
      { role: "system", content: "Respond ONLY with valid JSON." },
      { role: "user", content: 'Return: {"status":"ok"}' },
    ], { maxTokens: 100 });

    results.smartContent = completion.content ? completion.content.slice(0, 200) : "EMPTY";
    results.smartProviderUsed = completion.provider;
  } catch (e) {
    results.smartError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
