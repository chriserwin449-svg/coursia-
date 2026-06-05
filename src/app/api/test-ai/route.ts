import { NextResponse } from "next/server";

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

  // Test Groq API
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Respond ONLY with valid JSON." },
            { role: "user", content: 'Return: {"status":"ok"}' },
          ],
          max_tokens: 50,
        }),
      });

      results.groqStatus = response.status;
      results.groqStatusText = response.statusText;
      const text = await response.text();
      results.groqResponse = text.slice(0, 1000);

      try {
        const json = JSON.parse(text);
        results.groqContent = json.choices?.[0]?.message?.content?.slice(0, 200) || "EMPTY";
        results.groqError = json.error;
      } catch { /* not JSON */ }
    } catch (e) {
      results.groqFetchError = e instanceof Error ? e.message : String(e);
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
    ], { maxTokens: 50 });

    results.smartContent = completion.content ? completion.content.slice(0, 200) : "EMPTY";
    results.smartProviderUsed = completion.provider;
  } catch (e) {
    results.smartError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
