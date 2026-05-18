import ZAI from "z-ai-web-dev-sdk";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type AIProvider = "google" | "openai" | "free";

interface ProviderInfo {
  provider: AIProvider;
  label: string;
  isFree: boolean;
  hasApiKey: boolean;
  model?: string;
}

function detectProviderFromKey(key: string): AIProvider {
  if (key.startsWith("AIza")) return "google";
  if (key.startsWith("sk-")) return "openai";
  return "free";
}

export async function getActiveProvider(): Promise<ProviderInfo> {
  const apiKey = getAIKey();
  if (apiKey) {
    const provider = detectProviderFromKey(apiKey);
    const labels: Record<AIProvider, string> = {
      google: "Google Gemini",
      openai: "OpenAI GPT-4o",
      free: "Free Tier",
    };
    const models: Record<AIProvider, string> = {
      google: "gemini-2.0-flash",
      openai: "gpt-4o",
      free: "default",
    };
    return { provider, label: labels[provider], isFree: false, hasApiKey: true, model: models[provider] };
  }
  return { provider: "free", label: "Free Tier (Coursia AI)", isFree: true, hasApiKey: false };
}

/**
 * Returns the admin API key from environment variables.
 * No user-provided keys — only the admin key in .env.local is used.
 */
function getAIKey(): string | null {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey && envKey.startsWith("sk-")) return envKey;
  return null;
}

const EXTERNAL_API_TIMEOUT = 30_000;

/**
 * Try an OpenAI API call with model fallback.
 * Attempts gpt-4o first, then falls back to gpt-4o-mini if the model is unavailable.
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
        console.error(`[OpenAI] Model ${model} failed (${response.status}): ${errorBody.slice(0, 200)}`);
        // If it's a model-not-found or authentication error, try next model
        if (response.status === 404 || response.status === 401) {
          continue;
        }
        // For rate limits or server errors, don't bother trying other models
        break;
      }
    } catch (error) {
      console.error(`[OpenAI] Model ${model} request failed:`, error instanceof Error ? error.message : error);
      // Network errors — try next model
      continue;
    }
  }

  return null;
}

export async function smartChatCompletion(messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) {
  const apiKey = getAIKey();
  if (apiKey) {
    const provider = detectProviderFromKey(apiKey);
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
              generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 4096 },
            }),
            timeoutMs: EXTERNAL_API_TIMEOUT,
          },
        );
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          return { content: text, provider: "google" as const };
        }
      } catch (error) {
        console.error(`[Gemini] Request failed, falling back to z-ai:`, error instanceof Error ? error.message : error);
      }
    }
    if (provider === "openai") {
      const result = await callOpenAIWithFallback(apiKey, messages, options);
      if (result) {
        return { content: result.content, provider: "openai" as const };
      }
      console.log("[OpenAI] All models failed, falling back to z-ai");
    }
  }
  console.log("[AI] Using z-ai (free tier) fallback");
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: messages as Array<{ role: "user" | "system" | "assistant"; content: string }>,
    thinking: { type: "disabled" },
  });
  const content = completion.choices?.[0]?.message?.content || "";
  return { content, provider: "free" as const };
}
