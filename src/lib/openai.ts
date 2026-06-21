import ZAI from "z-ai-web-dev-sdk";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type AIProvider = "zai" | "google" | "openai" | "groq" | "free";

interface ProviderInfo {
  provider: AIProvider;
  label: string;
  isFree: boolean;
  hasApiKey: boolean;
  model?: string;
}

export async function getActiveProvider(): Promise<ProviderInfo> {
  // Priority 1: z-ai SDK (always available, works on Vercel)
  try {
    const zai = await ZAI.create();
    if (zai) {
      return { provider: "zai", label: "Coursia AI", isFree: true, hasApiKey: true, model: "default" };
    }
  } catch { /* not available */ }

  // Priority 2: GROQ_API_KEY
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return { provider: "groq", label: "Groq (Llama 3.3 70B)", isFree: true, hasApiKey: true, model: "llama-3.3-70b-versatile" };
  }

  // Priority 3: OPENAI_API_KEY (can be Google Gemini or OpenAI)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) {
      return { provider: "google", label: "Google Gemini", isFree: false, hasApiKey: true, model: "gemini-2.0-flash" };
    }
    if (apiKey.startsWith("sk-")) {
      return { provider: "openai", label: "OpenAI GPT-4o", isFree: false, hasApiKey: true, model: "gpt-4o" };
    }
    if (apiKey.startsWith("gsk_")) {
      return { provider: "groq", label: "Groq (Llama 3.3 70B)", isFree: true, hasApiKey: true, model: "llama-3.3-70b-versatile" };
    }
  }

  return { provider: "free", label: "Free Tier (Coursia AI)", isFree: true, hasApiKey: false };
}

const EXTERNAL_API_TIMEOUT = 60_000;

/**
 * Call z-ai SDK (primary provider — always available)
 */
async function callZAI(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: messages as Array<{ role: "user" | "system" | "assistant"; content: string }>,
      thinking: { type: "disabled" },
    });
    const content = completion.choices?.[0]?.message?.content || "";
    if (content) {
      console.log("[ZAI] Success");
      return { content };
    }
  } catch (error) {
    console.error("[ZAI] Failed:", error instanceof Error ? error.message : error);
  }
  return null;
}

/**
 * Call Groq API (uses OpenAI-compatible format)
 */
async function callGroq(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile"];

  for (const model of models) {
    try {
      const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 8192,
        }),
        timeoutMs: EXTERNAL_API_TIMEOUT,
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        if (content) {
          console.log(`[Groq] Success with model: ${model}`);
          return { content };
        }
      } else {
        const errorBody = await response.text().catch(() => "");
        console.error(`[Groq] Model ${model} failed (${response.status}): ${errorBody.slice(0, 300)}`);
        if (response.status === 404) continue;
        break;
      }
    } catch (error) {
      console.error(`[Groq] Model ${model} request failed:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  return null;
}

/**
 * Try an OpenAI API call with model fallback.
 */
async function callOpenAIWithFallback(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  const models = ["gpt-4o", "gpt-4o-mini"];

  for (const model of models) {
    try {
      const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 8192,
        }),
        timeoutMs: EXTERNAL_API_TIMEOUT,
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        if (content) {
          console.log(`[OpenAI] Success with model: ${model}`);
          return { content };
        }
      } else {
        const errorBody = await response.text().catch(() => "");
        console.error(`[OpenAI] Model ${model} failed (${response.status}): ${errorBody.slice(0, 300)}`);
        if (response.status === 404 || response.status === 401) continue;
        break;
      }
    } catch (error) {
      console.error(`[OpenAI] Model ${model} request failed:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  return null;
}

/**
 * Smart AI chat completion with automatic provider routing.
 * Priority: z-ai SDK > Groq > OpenAI/Google > Free
 */
export async function smartChatCompletion(messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) {
  // Priority 1: z-ai SDK (always available, works everywhere including Vercel)
  console.log("[AI] Trying z-ai SDK as primary provider...");
  const zaiResult = await callZAI(messages, options);
  if (zaiResult) return { content: zaiResult.content, provider: "zai" as const };

  // Priority 2: Groq (free, fast)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log("[AI] Using Groq");
    const result = await callGroq(groqKey, messages, options);
    if (result) return { content: result.content, provider: "groq" as const };
    console.error("[Groq] Failed");
  }

  // Priority 3: OPENAI_API_KEY (can be Google Gemini or OpenAI)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    // Google Gemini
    if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) {
      console.log("[AI] Using Google Gemini");
      try {
        const response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: (() => {
                // Gemini doesn't support system role — merge system prompt into first user message
                const systemMsg = messages.find((m) => m.role === "system");
                const nonSystem = messages.filter((m) => m.role !== "system");
                const merged = nonSystem.map((m, i) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: (i === 0 && systemMsg ? `[INSTRUCTIONS]\n${systemMsg.content}\n\n[/INSTRUCTIONS]\n\n` : "") + m.content }],
                }));
                return merged.length > 0 ? merged : [{ role: "user" as const, parts: [{ text: "Hello" }] }];
              })(),
              generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 8192 },
            }),
            timeoutMs: EXTERNAL_API_TIMEOUT,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) return { content: text, provider: "google" as const };
        }
      } catch (error) {
        console.error(`[Gemini] Request failed:`, error instanceof Error ? error.message : error);
      }
    }

    // OpenAI
    if (apiKey.startsWith("sk-")) {
      console.log("[AI] Using OpenAI");
      const result = await callOpenAIWithFallback(apiKey, messages, options);
      if (result) return { content: result.content, provider: "openai" as const };
      console.log("[OpenAI] All models failed");
    }
  }

  // All providers failed
  console.error("[AI] All providers failed — no course can be generated");
  return { content: "", provider: "free" as const };
}
