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
  try {
    const zai = await ZAI.create();
    if (zai) {
      return { provider: "zai", label: "Coursia AI", isFree: true, hasApiKey: true, model: "default" };
    }
  } catch { /* not available */ }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return { provider: "groq", label: "Groq (Llama 3.3 70B)", isFree: true, hasApiKey: true, model: "llama-3.3-70b-versatile" };
  }

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
 * Sleep utility for retry backoff
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry with exponential backoff — used by all provider calls
 * Delays: 2s, 4s, 8s (4 total attempts)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T | null>,
  label: string,
  maxRetries = 3,
): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result !== null && result !== undefined) return result;
      // If result is null (empty response), retry
      if (attempt < maxRetries) {
        const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
        console.log(`[${label}] Empty/null response, retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      return null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRetryable = msg.includes("429") || msg.includes("timeout") || msg.includes("ECONNRESET")
        || msg.includes("ETIMEDOUT") || msg.includes("socket") || msg.includes("fetch failed")
        || msg.includes("aborted") || msg.includes("abort") || msg.includes("503")
        || msg.includes("502") || msg.includes("500");

      if (attempt < maxRetries && isRetryable) {
        const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
        console.log(`[${label}] Attempt ${attempt + 1} failed (${msg.slice(0, 120)}), retry in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      console.error(`[${label}] Attempt ${attempt + 1} FAILED permanently: ${msg.slice(0, 200)}`);
      return null;
    }
  }
  return null;
}

/**
 * Classify error for user-friendly messages
 */
export function classifyAIError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("429") || msg.includes("rate")) return "RATE_LIMIT";
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) return "TIMEOUT";
  if (msg.includes("401") || msg.includes("API key") || msg.includes("apiKey") || msg.includes("unauthorized")) return "AUTH";
  if (msg.includes("ECONNRESET") || msg.includes("socket") || msg.includes("fetch failed") || msg.includes("network")) return "NETWORK";
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) return "SERVER";
  if (msg.includes("JSON") || msg.includes("parse")) return "PARSE";
  if (!msg || msg === "undefined" || msg === "") return "EMPTY";
  return "UNKNOWN";
}

/**
 * Call z-ai SDK (primary provider — always available)
 * Uses singleton instance to avoid cold starts
 */
let zaiSingleton: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let zaiSingletonPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null;

async function getZAI(): Promise<Awaited<ReturnType<typeof ZAI.create>>> {
  if (zaiSingleton) return zaiSingleton;
  if (!zaiSingletonPromise) {
    zaiSingletonPromise = ZAI.create();
  }
  zaiSingleton = await zaiSingletonPromise;
  return zaiSingleton;
}

async function callZAI(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  return retryWithBackoff(async () => {
    try {
      const zai = await getZAI();
      const completion = await zai.chat.completions.create({
        messages: messages as Array<{ role: "user" | "system" | "assistant"; content: string }>,
        thinking: { type: "disabled" },
        // Pass temperature and max_tokens to SDK
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      });
      const content = completion.choices?.[0]?.message?.content || "";
      if (content && content.trim().length > 0) {
        console.log(`[ZAI] Success: ${content.length} chars`);
        return { content: content.trim() };
      }
      console.warn("[ZAI] Empty response from SDK");
      return null;
    } catch (error) {
      console.error("[ZAI] Error:", error instanceof Error ? error.message : error);
      throw error; // re-throw for retryWithBackoff to handle
    }
  }, "ZAI", 3); // 3 retries with 2s, 4s, 8s backoff for 429 errors
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

  return retryWithBackoff(async () => {
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
          if (content && content.trim().length > 0) {
            console.log(`[Groq] Success with model: ${model}, ${content.length} chars`);
            return { content: content.trim() };
          }
          console.warn(`[Groq] Model ${model}: empty response`);
        } else {
          const errorBody = await response.text().catch(() => "");
          console.error(`[Groq] Model ${model} failed (${response.status}): ${errorBody.slice(0, 300)}`);
          if (response.status === 404) continue;
          return null;
        }
      } catch (error) {
        console.error(`[Groq] Model ${model} request failed:`, error instanceof Error ? error.message : error);
        continue;
      }
    }
    return null;
  }, "Groq", 3);
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

  return retryWithBackoff(async () => {
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
          if (content && content.trim().length > 0) {
            console.log(`[OpenAI] Success with model: ${model}, ${content.length} chars`);
            return { content: content.trim() };
          }
          console.warn(`[OpenAI] Model ${model}: empty response`);
        } else {
          const errorBody = await response.text().catch(() => "");
          console.error(`[OpenAI] Model ${model} failed (${response.status}): ${errorBody.slice(0, 300)}`);
          if (response.status === 404 || response.status === 401) continue;
          return null;
        }
      } catch (error) {
        console.error(`[OpenAI] Model ${model} request failed:`, error instanceof Error ? error.message : error);
        continue;
      }
    }
    return null;
  }, "OpenAI", 3);
}

/**
 * Smart AI chat completion with automatic provider routing.
 * Priority: z-ai SDK > Groq > OpenAI/Google > Free
 * Each provider has its own retry logic with exponential backoff.
 */
export async function smartChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
) {
  console.log(`[AI] Starting smartChatCompletion (maxTokens: ${options?.maxTokens ?? 'default'}, temperature: ${options?.temperature ?? 'default'})`);

  // Priority 1: z-ai SDK (always available, works everywhere including Vercel)
  console.log("[AI] Trying z-ai SDK as primary provider...");
  const zaiResult = await callZAI(messages, options);
  if (zaiResult) {
    console.log(`[AI] z-ai SDK succeeded: ${zaiResult.content.length} chars`);
    return { content: zaiResult.content, provider: "zai" as const };
  }
  console.warn("[AI] z-ai SDK failed, falling through...");

  // Priority 2: Groq (free, fast)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log("[AI] Trying Groq...");
    const result = await callGroq(groqKey, messages, options);
    if (result) {
      console.log(`[AI] Groq succeeded: ${result.content.length} chars`);
      return { content: result.content, provider: "groq" as const };
    }
    console.warn("[AI] Groq failed, falling through...");
  }

  // Priority 3: OPENAI_API_KEY (can be Google Gemini or OpenAI)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    // Google Gemini
    if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) {
      console.log("[AI] Trying Google Gemini...");
      const geminiResult = await retryWithBackoff(async () => {
        try {
          const response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: (() => {
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
            if (text && text.trim().length > 0) {
              console.log(`[Gemini] Success: ${text.length} chars`);
              return { content: text.trim() };
            }
            console.warn("[Gemini] Empty response");
            return null;
          }
          const errorBody = await response.text().catch(() => "");
          console.error(`[Gemini] Failed (${response.status}): ${errorBody.slice(0, 300)}`);
          return null;
        } catch (error) {
          console.error("[Gemini] Request failed:", error instanceof Error ? error.message : error);
          throw error;
        }
      }, "Gemini", 2);

      if (geminiResult) {
        console.log(`[AI] Gemini succeeded: ${geminiResult.content.length} chars`);
        return { content: geminiResult.content, provider: "google" as const };
      }
      console.warn("[AI] Gemini failed, falling through...");
    }

    // OpenAI
    if (apiKey.startsWith("sk-")) {
      console.log("[AI] Trying OpenAI...");
      const result = await callOpenAIWithFallback(apiKey, messages, options);
      if (result) {
        console.log(`[AI] OpenAI succeeded: ${result.content.length} chars`);
        return { content: result.content, provider: "openai" as const };
      }
      console.warn("[AI] OpenAI all models failed");
    }
  }

  // All providers failed
  console.error("[AI] ALL PROVIDERS FAILED — no content generated");
  return { content: "", provider: "free" as const };
}