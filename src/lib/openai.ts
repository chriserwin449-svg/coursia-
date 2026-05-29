import ZAI from "z-ai-web-dev-sdk";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type AIProvider = "google" | "openai" | "groq" | "zai" | "free";

interface ProviderInfo {
  provider: AIProvider;
  label: string;
  isFree: boolean;
  hasApiKey: boolean;
  model?: string;
}

function detectProviderFromKey(key: string): AIProvider {
  if (key.startsWith("AIza") || key.startsWith("AQ.")) return "google";
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-")) return "openai";
  return "free";
}

export async function getActiveProvider(): Promise<ProviderInfo> {
  // Priority: GROQ_API_KEY > OPENAI_API_KEY > z-ai
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return { provider: "groq", label: "Groq (Llama 3.3 70B)", isFree: true, hasApiKey: true, model: "llama-3.3-70b-versatile" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const provider = detectProviderFromKey(apiKey);
    const labels: Record<AIProvider, string> = {
      google: "Google Gemini",
      openai: "OpenAI GPT-4o",
      groq: "Groq",
      zai: "Z.ai (Coursia AI)",
      free: "Free Tier",
    };
    const models: Record<AIProvider, string> = {
      google: "gemini-2.0-flash",
      openai: "gpt-4o",
      groq: "llama-3.3-70b-versatile",
      zai: "default",
      free: "default",
    };
    return { provider, label: labels[provider], isFree: false, hasApiKey: true, model: models[provider] };
  }

  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    return { provider: "zai", label: "Z.ai (Coursia AI)", isFree: true, hasApiKey: true, model: "default" };
  }

  return { provider: "free", label: "Free Tier (Coursia AI)", isFree: true, hasApiKey: false };
}

/**
 * Returns the admin API key from environment variables.
 */
function getAIKey(): string | null {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey && (envKey.startsWith("sk-") || envKey.startsWith("AIza") || envKey.startsWith("AQ."))) return envKey;
  return null;
}

/**
 * Create ZAI client from environment variables or file config.
 */
async function createZAIClient() {
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
    return ZAI.create({
      baseUrl: process.env.ZAI_BASE_URL,
      apiKey: process.env.ZAI_API_KEY,
      chatId: process.env.ZAI_CHAT_ID || "",
      userId: process.env.ZAI_USER_ID || "",
      token: process.env.ZAI_TOKEN || "",
    });
  }
  return ZAI.create();
}

const EXTERNAL_API_TIMEOUT = 60_000;

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

export async function smartChatCompletion(messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) {
  // Priority 1: Groq (free, fast, works everywhere)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log("[AI] Using Groq");
    const result = await callGroq(groqKey, messages, options);
    if (result) return { content: result.content, provider: "groq" as const };
    console.error("[Groq] Failed");
  }

  // Priority 2: OPENAI_API_KEY (can be Google Gemini or OpenAI)
  const apiKey = getAIKey();
  if (apiKey) {
    const provider = detectProviderFromKey(apiKey);

    // Google Gemini
    if (provider === "google") {
      try {
        const response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: messages.filter((m) => m.role !== "system").map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
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
    if (provider === "openai") {
      const result = await callOpenAIWithFallback(apiKey, messages, options);
      if (result) return { content: result.content, provider: "openai" as const };
      console.log("[OpenAI] All models failed");
    }
  }

  // Priority 3: z-ai fallback (local dev only)
  try {
    console.log("[AI] Using z-ai fallback");
    const zai = await createZAIClient();
    const completion = await zai.chat.completions.create({
      messages: messages as Array<{ role: "user" | "system" | "assistant"; content: string }>,
      thinking: { type: "disabled" },
    });
    const content = completion.choices?.[0]?.message?.content || "";
    if (content) return { content, provider: "zai" as const };
  } catch (error) {
    console.error("[AI] z-ai fallback failed:", error instanceof Error ? error.message : error);
  }

  return { content: "", provider: "free" as const };
}
