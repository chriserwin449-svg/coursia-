import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type AIProvider = "zai" | "openrouter" | "google" | "openai" | "groq" | "free";

interface ProviderInfo {
  provider: AIProvider;
  label: string;
  isFree: boolean;
  hasApiKey: boolean;
  model?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAI CONFIGURATION
// Reads config from /etc/.z-ai-config OR from ZAI_* environment variables.
// The ZAI API requires: Authorization, X-Token, X-Chat-Id, X-User-Id headers.
// ═══════════════════════════════════════════════════════════════════════════

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId: string;
  userId: string;
  token: string;
}

let zaiConfigCache: ZAIConfig | null = null;

async function loadZAIConfig(): Promise<ZAIConfig> {
  if (zaiConfigCache) return zaiConfigCache;

  // Strategy 1: Read /etc/.z-ai-config (available in sandbox)
  try {
    const fs = await import('fs');
    const raw = fs.readFileSync('/etc/.z-ai-config', 'utf-8').trim();
    const cfg = JSON.parse(raw);
    if (cfg.baseUrl && cfg.apiKey && cfg.token) {
      console.log('[ZAI] Config loaded from /etc/.z-ai-config');
      zaiConfigCache = {
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        chatId: cfg.chatId || '',
        userId: cfg.userId || '',
        token: cfg.token,
      };
      return zaiConfigCache;
    }
  } catch {
    /* file not available */
  }

  // Strategy 2: Environment variables (for production deployments)
  const token = process.env.ZAI_TOKEN;
  if (!token) {
    throw new Error(
      'ZAI token not found. Set ZAI_TOKEN env var or ensure /etc/.z-ai-config exists.'
    );
  }

  console.log('[ZAI] Config loaded from env vars');
  zaiConfigCache = {
    baseUrl: process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1',
    apiKey: process.env.ZAI_API_KEY || 'Z.ai',
    chatId: process.env.ZAI_CHAT_ID || '',
    userId: process.env.ZAI_USER_ID || '',
    token,
  };
  return zaiConfigCache;
}

export async function getActiveProvider(): Promise<ProviderInfo> {
  try {
    await loadZAIConfig();
    return { provider: "zai", label: "Coursia AI", isFree: true, hasApiKey: true, model: "glm-4-plus" };
  } catch {
    /* ZAI not available */
  }

  // OpenRouter — FREE, no credit card, available from Africa
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return { provider: "openrouter", label: "OpenRouter (Nemotron Ultra 550B)", isFree: true, hasApiKey: true, model: "nvidia/nemotron-3-ultra-550b-a55b:free" };
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return { provider: "groq", label: "Groq (Qwen 3.6 27B)", isFree: true, hasApiKey: true, model: "qwen/qwen3.6-27b" };
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
      return { provider: "groq", label: "Groq (Qwen 3.6 27B)", isFree: true, hasApiKey: true, model: "qwen/qwen3.6-27b" };
    }
  }

  return { provider: "free", label: "Free Tier (Coursia AI)", isFree: true, hasApiKey: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT ZAI API — bypasses z-ai-web-dev-sdk entirely
// Uses fetch() to avoid config file dependency (no ZAI.create())
// ═══════════════════════════════════════════════════════════════════════════

const ZAI_TIMEOUT = 60_000;

export interface ZAIClient {
  config: ZAIConfig;
  chatCompletion: (messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) => Promise<any>;
  invokeFunction: (functionName: string, params: Record<string, unknown>) => Promise<any>;
}

export async function getZAI(): Promise<ZAIClient> {
  const config = await loadZAIConfig();
  return {
    config,
    async chatCompletion(messages, options) {
      const url = `${config.baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-Z-AI-From': 'Z',
        'X-Token': config.token,
      };
      if (config.chatId) headers['X-Chat-Id'] = config.chatId;
      if (config.userId) headers['X-User-Id'] = config.userId;

      const body: Record<string, unknown> = {
        messages,
        thinking: { type: 'disabled' },
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      };

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        timeoutMs: ZAI_TIMEOUT,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`ZAI API error ${response.status}: ${errorBody.slice(0, 300)}`);
      }
      return response.json();
    },
    async invokeFunction(functionName, params) {
      const url = `${config.baseUrl}/functions/invoke`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-Z-AI-From': 'Z',
        'X-Token': config.token,
      };
      if (config.chatId) headers['X-Chat-Id'] = config.chatId;
      if (config.userId) headers['X-User-Id'] = config.userId;

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ function_name: functionName, arguments: params }),
        timeoutMs: ZAI_TIMEOUT,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`ZAI function ${functionName} error ${response.status}: ${errorBody.slice(0, 300)}`);
      }

      const json = await response.json();
      return json.result;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CLASSES
// ═══════════════════════════════════════════════════════════════════════════

export class AIProviderError extends Error {
  provider: string;
  lastError: Error | null;
  attempts: number;

  constructor(provider: string, lastError: Error | null, attempts: number) {
    const msg = lastError
      ? `All ${attempts} attempts to ${provider} failed. Last error: ${lastError.message}`
      : `${provider} returned empty/null response after ${attempts} attempts`;
    super(msg);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

export class AllProvidersFailedError extends Error {
  providerErrors: Array<{ provider: string; error: string }>;

  constructor(providerErrors: Array<{ provider: string; error: string }>) {
    const summary = providerErrors.map((e) => `${e.provider}: ${e.error.slice(0, 300)}`).join(' | ');
    super(`ALL AI providers failed: ${summary}`);
    this.name = 'AllProvidersFailedError';
    this.providerErrors = providerErrors;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Retry with exponential backoff
// ═══════════════════════════════════════════════════════════════════════════

const EXTERNAL_API_TIMEOUT = 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retryWithBackoff<T>(
  fn: () => Promise<T | null>,
  label: string,
  maxRetries = 3,
): Promise<T | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (result !== null && result !== undefined) return result;
      if (attempt < maxRetries) {
        const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
        console.log(`[${label}] Empty/null response, retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      lastError = new Error(`Empty/null response after ${maxRetries + 1} attempts`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      const isRetryable = msg.includes('429') || msg.includes('timeout') || msg.includes('ECONNRESET')
        || msg.includes('ETIMEDOUT') || msg.includes('socket') || msg.includes('fetch failed')
        || msg.includes('aborted') || msg.includes('abort') || msg.includes('503')
        || msg.includes('502') || msg.includes('500');

      if (attempt < maxRetries && isRetryable) {
        const delay = 2000 * Math.pow(2, attempt);
        console.log(`[${label}] Attempt ${attempt + 1} failed (${msg.slice(0, 120)}), retry in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      console.error(`[${label}] Attempt ${attempt + 1} FAILED permanently: ${msg.slice(0, 500)}`);
      throw new AIProviderError(label, lastError, attempt + 1);
    }
  }
  throw new AIProviderError(label, lastError, maxRetries + 1);
}

export function classifyAIError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('429') || msg.includes('rate')) return 'RATE_LIMIT';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return 'TIMEOUT';
  if (msg.includes('401') || msg.includes('API key') || msg.includes('apiKey') || msg.includes('unauthorized')) return 'AUTH';
  if (msg.includes('ECONNRESET') || msg.includes('socket') || msg.includes('fetch failed') || msg.includes('network')) return 'NETWORK';
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return 'SERVER';
  if (msg.includes('JSON') || msg.includes('parse')) return 'PARSE';
  if (!msg || msg === 'undefined' || msg === '') return 'EMPTY';
  if (msg.includes('AllProvidersFailed') || msg.includes('ALL AI providers')) return 'AI_GENERATION_FAILED';
  return 'UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER CALLS
// ═══════════════════════════════════════════════════════════════════════════

async function callZAI(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  return retryWithBackoff(async () => {
    const zai = await getZAI();
    const completion = await zai.chatCompletion(messages, options);
    const content = completion.choices?.[0]?.message?.content || '';
    if (content && content.trim().length > 0) {
      console.log(`[ZAI] Success: ${content.length} chars`);
      return { content: content.trim() };
    }
    console.warn('[ZAI] Empty response from API');
    return null;
  }, 'ZAI', 3);
}

/**
 * Groq TPM-aware caller with dynamic rate limiting.
 *
 * FREE TIER CONSTRAINTS (org_01kst877rzetp89zmg9bmfznq2, on_demand):
 * - TPM limit: 8,000 tokens per minute
 * - Each request's (prompt_tokens + max_tokens) must stay well under 8,000
 * - Between calls: wait based on tokens used + remaining quota from headers
 *
 * Models (tested Aug 2025):
 * - qwen/qwen3.6-27b: NON-reasoning, fast, good quality, BEST CHOICE for TPM-constrained
 * - llama-3.3-70b-versatile: NON-reasoning, 70B params, high quality
 * - llama/llama-4-scout-17b-16e-instruct: NON-reasoning, Llama 4, newer
 * - openai/gpt-oss-120b: REASONING model, works but reasoning tokens eat budget (LAST RESORT)
 * - openai/gpt-oss-20b: BLOCKED (403) at org level
 * - groq/compound-mini: BLOCKED (403) at org level
 * - groq/compound: BLOCKED (403) at org level
 */

const GROQ_TPM_LIMIT = 30000;
const GROQ_MAX_TOKENS = 4000;       // max_tokens per request (leaves ~4000 for prompt)
const GROQ_MIN_DELAY_MS = 5_000;    // minimum 30s between calls (8000 TPM / ~4000 per call)
const GROQ_MAX_DELAY_MS = 15_000;    // safety cap
let lastGroqCallTime = 0;
let lastGroqTokensUsed = 0;

async function callGroq(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  // Models ordered by preference: non-reasoning first (reliable under TPM limit),
  // reasoning models last (fragile, reasoning tokens waste budget).
  const models = [
    'qwen/qwen3.6-27b',
    'llama-3.3-70b-versatile',
    'llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-120b',
  ];

  const errors: string[] = [];

  // Enforce minimum delay between Groq calls (TPM rate limiting)
  const now = Date.now();
  const timeSinceLastCall = now - lastGroqCallTime;
  if (timeSinceLastCall < GROQ_MIN_DELAY_MS && lastGroqTokensUsed > 0) {
    // Calculate dynamic delay: if we used ~5000 tokens, need ~37.5s to reset at 8000/min
    const dynamicDelay = Math.min(
      Math.max(
        Math.ceil((lastGroqTokensUsed / GROQ_TPM_LIMIT) * 60_000),
        GROQ_MIN_DELAY_MS,
      ),
      GROQ_MAX_DELAY_MS,
    );
    const remaining = dynamicDelay - timeSinceLastCall;
    if (remaining > 0) {
      console.log(`[Groq] TPM rate limit: waiting ${remaining}ms (${lastGroqTokensUsed} tokens used ${Math.round(timeSinceLastCall / 1000)}s ago)`);
      await sleep(remaining);
    }
  }

  for (const model of models) {
    let lastErr = '';
    const isReasoningModel = model.includes('gpt-oss-120b');
    // Cap max_tokens to stay under TPM limit even with large prompts
    const effectiveMaxTokens = Math.min(
      options?.maxTokens ?? GROQ_MAX_TOKENS,
      GROQ_MAX_TOKENS,
    );

    // Each model gets 1 retry for retryable errors only
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        console.log(`[Groq] Trying ${model} (attempt ${attempt + 1}, max_tokens=${effectiveMaxTokens})...`);

        // Build request body — reasoning model gets effort=low to reduce reasoning token waste
        const body: Record<string, unknown> = {
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: effectiveMaxTokens,
        };
        if (isReasoningModel) {
          (body as Record<string, unknown>).reasoning = { effort: 'low' };
        }

        const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          timeoutMs: EXTERNAL_API_TIMEOUT,
        });

        // Read rate limit headers for dynamic delay calculation
        const rateLimitRemaining = parseInt(response.headers.get('x-ratelimit-remaining-tokens') || '0', 10);
        const rateLimitLimit = parseInt(response.headers.get('x-ratelimit-limit-tokens') || String(GROQ_TPM_LIMIT), 10);
        if (rateLimitLimit > 0) {
          console.log(`[Groq] Rate limit: ${rateLimitRemaining}/${rateLimitLimit} tokens remaining`);
        }

        // Track tokens for TPM delay (from response or estimated)
        let tokensUsedThisCall = effectiveMaxTokens; // conservative estimate

        if (response.ok) {
          const data = await response.json();
          const choice = data.choices?.[0];
          const content = choice?.message?.content || '';
          const reasoning = (choice?.message as Record<string, unknown> | undefined)?.reasoning || '';
          const finishReason = choice?.finish_reason || '';

          // Track actual token usage from response
          const usage = data.usage;
          if (usage) {
            tokensUsedThisCall = (usage.total_tokens || usage.prompt_tokens + usage.completion_tokens || effectiveMaxTokens);
          }
          lastGroqCallTime = Date.now();
          lastGroqTokensUsed = tokensUsedThisCall;
          console.log(`[Groq] Tokens used: ${tokensUsedThisCall} (prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens})`);

          // Case 1: Normal response with content
          if (content && content.trim().length > 0) {
            console.log(`[Groq] SUCCESS with ${model}: ${content.length} chars`);
            return { content: content.trim() };
          }

          // Case 2: Reasoning model — content empty but reasoning has content
          if (isReasoningModel && finishReason === 'length' && reasoning && typeof reasoning === 'string' && reasoning.trim().length > 0) {
            console.warn(`[Groq] ${model}: content empty (finish_reason=length), trying reasoning extraction (${(reasoning as string).length} chars)`);
            const extracted = extractAnswerFromReasoning(reasoning as string);
            if (extracted && extracted.trim().length > 0) {
              console.log(`[Groq] ${model}: Extracted ${extracted.length} chars from reasoning`);
              return { content: extracted.trim() };
            }
          }

          // Case 3: Empty content, no reasoning fallback
          console.warn(`[Groq] ${model}: OK but empty content (finish_reason=${finishReason}), next model`);
          lastErr = `Model ${model}: empty response (finish_reason=${finishReason})`;
          break;
        } else {
          const errorBody = await response.text().catch(() => '');
          const httpErr = `Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 300)}`;
          console.error(`[Groq] ${httpErr}`);
          lastErr = httpErr;
          lastGroqCallTime = Date.now();
          lastGroqTokensUsed = effectiveMaxTokens;

          // Non-retryable → skip to next model
          if (response.status === 404 || response.status === 401 || response.status === 403 || response.status === 400 || response.status === 413) {
            console.warn(`[Groq] ${model} failed with ${response.status} (not retryable), trying next model...`);
            break;
          }
          // Retryable: 429, 500, 502, 503
          if (attempt < 1) {
            const delay = 2000 * Math.pow(2, attempt);
            console.log(`[Groq] ${model} retryable error, retry in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          break;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        lastErr = `Model ${model}: ${errMsg.slice(0, 300)}`;
        console.error(`[Groq] ${lastErr}`);

        const isRetryable = errMsg.includes('429') || errMsg.includes('timeout') || errMsg.includes('ECONNRESET')
          || errMsg.includes('503') || errMsg.includes('502') || errMsg.includes('500');
        if (attempt < 1 && isRetryable) {
          const delay = 2000 * Math.pow(2, attempt);
          console.log(`[Groq] ${model} fetch error, retry in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        break;
      }
    }
    errors.push(lastErr);
  }

  const joined = errors.join(' | ');
  console.error(`[Groq] ALL MODELS FAILED: ${joined}`);
  throw new Error(joined);
}

// ═══════════════════════════════════════════════════════════════════════════
// OPENROUTER — Free models, no credit card, no TPM limit like Groq
// API is 100% OpenAI-compatible. Models rotate — check openrouter.ai/collections/free-models
// Rate limits: 50 req/day (free) or 1000 req/day (with $10 credit)
// ═══════════════════════════════════════════════════════════════════════════

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  // Free models ordered by quality for French course generation:
  // 1. Nemotron Ultra 550B — largest free model, excellent quality
  // 2. Nemotron Super 120B — great quality, fast
  // 3. Gemma 4 31B IT — Google quality, good in French
  // 4. Nemotron 3.5 Lightning — fast, huge context window
  // 5. OpenRouter free — default fallback
  const models = [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3.5-lightning:free',
    'openrouter/free',
  ];

  const errors: string[] = [];

  for (const model of models) {
    let lastErr = '';
    const effectiveMaxTokens = Math.min(
      options?.maxTokens ?? 4000,
      4000,
    );

    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        console.log(`[OpenRouter] Trying ${model} (attempt ${attempt + 1}, max_tokens=${effectiveMaxTokens})...`);

        const body: Record<string, unknown> = {
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: effectiveMaxTokens,
        };

        const response = await fetchWithTimeout(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://coursia.app',
            'X-Title': 'Coursia',
          },
          body: JSON.stringify(body),
          timeoutMs: EXTERNAL_API_TIMEOUT,
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const finishReason = data.choices?.[0]?.finish_reason || '';

          if (content && content.trim().length > 0) {
            console.log(`[OpenRouter] SUCCESS with ${model}: ${content.length} chars (finish=${finishReason})`);
            return { content: content.trim() };
          }

          console.warn(`[OpenRouter] ${model}: OK but empty content (finish_reason=${finishReason}), next model`);
          lastErr = `Model ${model}: empty response (finish_reason=${finishReason})`;
          break;
        } else {
          const errorBody = await response.text().catch(() => '');
          const httpErr = `Model ${model} HTTP ${response.status}: ${errorBody.slice(0, 300)}`;
          console.error(`[OpenRouter] ${httpErr}`);
          lastErr = httpErr;

          // Non-retryable → skip to next model
          if (response.status === 404 || response.status === 401 || response.status === 403 || response.status === 400) {
            console.warn(`[OpenRouter] ${model} failed with ${response.status} (not retryable), trying next model...`);
            break;
          }
          // Retryable: 429, 500, 502, 503
          if (attempt < 1) {
            const delay = 2000 * Math.pow(2, attempt);
            console.log(`[OpenRouter] ${model} retryable error, retry in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          break;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        lastErr = `Model ${model}: ${errMsg.slice(0, 300)}`;
        console.error(`[OpenRouter] ${lastErr}`);

        const isRetryable = errMsg.includes('429') || errMsg.includes('timeout') || errMsg.includes('ECONNRESET')
          || errMsg.includes('503') || errMsg.includes('502') || errMsg.includes('500');
        if (attempt < 1 && isRetryable) {
          const delay = 2000 * Math.pow(2, attempt);
          console.log(`[OpenRouter] ${model} fetch error, retry in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        break;
      }
    }
    errors.push(lastErr);
  }

  const joined = errors.join(' | ');
  console.error(`[OpenRouter] ALL MODELS FAILED: ${joined}`);
  throw new Error(joined);
}

/**
 * Attempts to extract a useful answer from a reasoning model's reasoning field.
 */
function extractAnswerFromReasoning(reasoning: string): string | null {
  const jsonBlockMatch = reasoning.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    const candidate = jsonBlockMatch[1].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) return candidate;
  }
  const trailingJsonMatch = reasoning.match(/([\[{][\s\S]*[\]}])\s*$/);
  if (trailingJsonMatch) {
    const candidate = trailingJsonMatch[1].trim();
    try { JSON.parse(candidate); return candidate; } catch { /* not valid JSON */ }
  }
  if (reasoning.length > 200) return reasoning.slice(-2000);
  return reasoning;
}

async function callOpenAIWithFallback(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  const models = ['gpt-4o', 'gpt-4o-mini'];

  return retryWithBackoff(async () => {
    for (const model of models) {
      try {
        const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, temperature: options?.temperature ?? 0.7, max_tokens: options?.maxTokens ?? 8192 }),
          timeoutMs: EXTERNAL_API_TIMEOUT,
        });
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content && content.trim().length > 0) return { content: content.trim() };
          console.warn(`[OpenAI] Model ${model}: empty response`);
        } else {
          const errorBody = await response.text().catch(() => '');
          console.error(`[OpenAI] Model ${model} failed (${response.status}): ${errorBody.slice(0, 300)}`);
          if (response.status === 404 || response.status === 401) continue;
          throw new Error(`OpenAI ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('404') || errMsg.includes('401')) continue;
        throw error;
      }
    }
    return null;
  }, 'OpenAI', 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART CHAT COMPLETION — automatic provider routing
// Priority: ZAI direct API > Groq > Gemini > OpenAI > throws
// ═══════════════════════════════════════════════════════════════════════════

export async function smartChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
) {
  console.log(`[AI] Starting smartChatCompletion (maxTokens: ${options?.maxTokens ?? 'default'}, temperature: ${options?.temperature ?? 'default'})`);

  const providerErrors: Array<{ provider: string; error: string }> = [];

  // Priority 1: ZAI direct API
  console.log('[AI] Trying ZAI direct API...');
  try {
    const zaiResult = await callZAI(messages, options);
    if (zaiResult) {
      console.log(`[AI] ZAI succeeded: ${zaiResult.content.length} chars`);
      return { content: zaiResult.content, provider: 'zai' as const };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[AI] ZAI FAILED: ${msg.slice(0, 300)}`);
    providerErrors.push({ provider: 'ZAI', error: msg });
  }

  // Priority 2: OpenRouter (free, no TPM limit, works from RDC)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    console.log('[AI] Trying OpenRouter...');
    try {
      const result = await callOpenRouter(openrouterKey, messages, options);
      if (result) {
        console.log(`[AI] OpenRouter succeeded: ${result.content.length} chars`);
        return { content: result.content, provider: 'openrouter' as const };
      }
      providerErrors.push({ provider: 'OpenRouter', error: 'Returned empty response' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AI] OpenRouter FAILED: ${msg.slice(0, 300)}`);
      providerErrors.push({ provider: 'OpenRouter', error: msg });
    }
  }

  // Priority 3: Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    console.log('[AI] Trying Groq...');
    try {
      const result = await callGroq(groqKey, messages, options);
      if (result) {
        console.log(`[AI] Groq succeeded: ${result.content.length} chars`);
        return { content: result.content, provider: 'groq' as const };
      }
      providerErrors.push({ provider: 'Groq', error: 'Returned empty response' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[AI] Groq FAILED: ${msg.slice(0, 300)}`);
      providerErrors.push({ provider: 'Groq', error: msg });
    }
  } else {
    providerErrors.push({ provider: 'Groq', error: 'No GROQ_API_KEY configured' });
  }

  // Priority 4: OPENAI_API_KEY (Gemini or OpenAI)
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    if (apiKey.startsWith('AIza') || apiKey.startsWith('AQ.')) {
      console.log('[AI] Trying Google Gemini...');
      try {
        const geminiResult = await retryWithBackoff(async () => {
          try {
            const response = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: (() => {
                    const systemMsg = messages.find((m) => m.role === 'system');
                    const nonSystem = messages.filter((m) => m.role !== 'system');
                    return nonSystem.map((m, i) => ({
                      role: m.role === 'assistant' ? 'model' : 'user',
                      parts: [{ text: (i === 0 && systemMsg ? `[INSTRUCTIONS]\n${systemMsg.content}\n\n[/INSTRUCTIONS]\n\n` : '') + m.content }],
                    }));
                  })(),
                  generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 8192 },
                }),
                timeoutMs: EXTERNAL_API_TIMEOUT,
              },
            );
            if (response.ok) {
              const data = await response.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text && text.trim().length > 0) return { content: text.trim() };
              return null;
            }
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Gemini HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
          } catch (error) { throw error; }
        }, 'Gemini', 2);

        if (geminiResult) {
          console.log(`[AI] Gemini succeeded: ${geminiResult.content.length} chars`);
          return { content: geminiResult.content, provider: 'google' as const };
        }
        providerErrors.push({ provider: 'Gemini', error: 'Returned empty response' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        providerErrors.push({ provider: 'Gemini', error: msg });
      }
    }

    if (apiKey.startsWith('sk-')) {
      console.log('[AI] Trying OpenAI...');
      try {
        const result = await callOpenAIWithFallback(apiKey, messages, options);
        if (result) {
          console.log(`[AI] OpenAI succeeded: ${result.content.length} chars`);
          return { content: result.content, provider: 'openai' as const };
        }
        providerErrors.push({ provider: 'OpenAI', error: 'Returned empty response' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        providerErrors.push({ provider: 'OpenAI', error: msg });
      }
    }
  } else {
    providerErrors.push({ provider: 'OpenAI/Gemini', error: 'No OPENAI_API_KEY configured' });
  }

  console.error('[AI] ═══ ALL PROVIDERS FAILED ═══');
  for (const pe of providerErrors) console.error(`  ${pe.provider}: ${pe.error}`);
  throw new AllProvidersFailedError(providerErrors);
}
