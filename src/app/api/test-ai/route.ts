import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  const apiKey = process.env.OPENAI_API_KEY;
  results.keySet = !!apiKey;
  results.keyPrefix = apiKey?.slice(0, 12) || "NONE";

  // Direct Gemini API test - show EXACT error
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
        generationConfig: { maxOutputTokens: 50 },
      }),
    });

    results.geminiStatus = response.status;
    results.geminiStatusText = response.statusText;

    const text = await response.text();
    results.geminiResponse = text.slice(0, 1000);

    // Try parsing
    try {
      const json = JSON.parse(text);
      results.geminiError = json.error;
      results.geminiCandidates = json.candidates?.length || 0;
      if (json.candidates?.[0]) {
        results.geminiContent = json.candidates[0].content?.parts?.[0]?.text?.slice(0, 200) || "NO TEXT";
      }
    } catch {
      // not JSON
    }
  } catch (e) {
    results.fetchError = e instanceof Error ? e.message : String(e);
  }

  // Also try gemini-2.5-flash as alternative
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
        generationConfig: { maxOutputTokens: 50 },
      }),
    });
    results.gemini25Status = response.status;
    const text = await response.text();
    results.gemini25Response = text.slice(0, 500);
  } catch (e) {
    results.gemini25Error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
