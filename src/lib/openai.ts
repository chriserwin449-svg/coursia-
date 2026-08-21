import { fetchWithTimeout } from "@/lib/fetch-timeout";

// ═══════════════════════════════════════════════════════════════════════════
// AI PROVIDER — Single source of truth for AI configuration
// Only Groq is used for course generation.
// Environment variables:
//   GROQ_API_KEY  — Required. The Groq API key.
//   GROQ_MODEL    — Optional. Model name (default: qwen/qwen3.6-27b)
// ═══════════════════════════════════════════════════════════════════════════

export type AIProvider = "groq";

interface ProviderInfo {
  provider: AIProvider;
  label: string;
  isFree: boolean;
  hasApiKey: boolean;
  model?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAI — Only used for web_search / page_reader (course research), NOT for AI generation.
// This is kept for the generate route's research step, not for chat completion.
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

  try {
    const fs = await import('fs');
    const raw = fs.readFileSync('/etc/.z-ai-config', 'utf-8').trim();
    const cfg = JSON.parse(raw);
    if (cfg.baseUrl && cfg.apiKey && cfg.token) {
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
    /* file not available in production */
  }

  const token = process.env.ZAI_TOKEN;
  if (!token) {
    throw new Error('ZAI token not found');
  }
  zaiConfigCache = {
    baseUrl: process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1',
    apiKey: process.env.ZAI_API_KEY || 'Z.ai',
    chatId: process.env.ZAI_CHAT_ID || '',
    userId: process.env.ZAI_USER_ID || '',
    token,
  };
  return zaiConfigCache;
}

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
        method: 'POST', headers, body: JSON.stringify(body), timeoutMs: ZAI_TIMEOUT,
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
        method: 'POST', headers,
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
// ERROR CLASSES (kept for backward compatibility with generate route)
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
    super(`AI generation failed: ${summary}`);
    this.name = 'AllProvidersFailedError';
    this.providerErrors = providerErrors;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const EXTERNAL_API_TIMEOUT = 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function classifyAIError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('429') || msg.includes('rate')) return 'RATE_LIMIT';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return 'TIMEOUT';
  if (msg.includes('401') || msg.includes('API key') || msg.includes('apiKey') || msg.includes('unauthorized')) return 'AUTH';
  if (msg.includes('ECONNRESET') || msg.includes('socket') || msg.includes('fetch failed') || msg.includes('network')) return 'NETWORK';
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return 'SERVER';
  if (msg.includes('JSON') || msg.includes('parse')) return 'PARSE';
  if (!msg || msg === 'undefined' || msg === '') return 'EMPTY';
  return 'UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVE PROVIDER INFO (for /api/ai-status and /api/test-ai)
// ═══════════════════════════════════════════════════════════════════════════

export async function getActiveProvider(): Promise<ProviderInfo> {
 const groqKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'qwen/qwen3.6-27b';
  if (groqKey) {
    return { provider: "groq", label: `Groq (${model})`, isFree: true, hasApiKey: true, model };
  }
  return { provider: "groq", label: "Groq (not configured)", isFree: true, hasApiKey: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// GROQ — The only AI provider for course generation
// TPM-aware with dynamic rate limiting.
// Free tier: 30,000 TPM, 30 RPM, 14,400 RPD
// ═══════════════════════════════════════════════════════════════════════════

const GROQ_TPM_LIMIT = 30000;
const GROQ_MAX_TOKENS = 4096;       // cap for qwen3 (prompt + thinking + output must fit model context)
const GROQ_MIN_DELAY_MS = 15_000;      // 15s minimum (12K tokens per call needs ~24s at 30K TPM)
const GROQ_MAX_DELAY_MS = 30_000;      // safety cap
let lastGroqCallTime = 0;
let lastGroqTokensUsed = 0;

async function callGroq(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured. Set GROQ_API_KEY environment variable.');
  }

  const model = process.env.GROQ_MODEL || 'qwen/qwen3.6-27b';
  let currentMaxTokens = Math.min(
    options?.maxTokens ?? GROQ_MAX_TOKENS,
    GROQ_MAX_TOKENS,
  );

  // Enforce TPM rate limiting between calls
  const now = Date.now();
  const timeSinceLastCall = now - lastGroqCallTime;
  if (timeSinceLastCall < GROQ_MIN_DELAY_MS && lastGroqTokensUsed > 0) {
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

  // Try the model with 2 retries for retryable errors
  let lastErr = '';
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      console.log(`[Groq] Calling ${model} (attempt ${attempt + 1}, max_tokens=${currentMaxTokens})...`);

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: currentMaxTokens,
      };

      const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        timeoutMs: EXTERNAL_API_TIMEOUT,
      });

      // Track tokens for TPM delay
      let tokensUsedThisCall = currentMaxTokens;

      if (response.ok) {
        const data = await response.json();
        const choice = data.choices?.[0];
        let rawContent = choice?.message?.content || '';
        const finishReason = choice?.finish_reason || '';

        // Qwen 3 (and other reasoning models) wraps thinking in <think>...</think> tags.
        // The actual response comes AFTER the closing </think> tag.
        // We must strip the thinking block so downstream JSON parsers work.
        const THINK_OPEN = '<think>';
        const THINK_CLOSE = '</think>';
        if (rawContent.includes(THINK_OPEN)) {
          const thinkEnd = rawContent.lastIndexOf(THINK_CLOSE);
          if (thinkEnd !== -1) {
            const afterThink = rawContent.slice(thinkEnd + THINK_CLOSE.length).trim();
            if (afterThink.length > 0) {
              console.log(`[Groq] Stripped <think> block (${rawContent.length - afterThink.length} chars of thinking removed)`);
              rawContent = afterThink;
            } else {
              // Thinking consumed all output — nothing useful after </think>
              console.warn(`[Groq] Model returned ONLY thinking content (no actual response after </think>)`);
            }
          }
        }

        const content = rawContent.trim();

        const usage = data.usage;
        if (usage) {
          tokensUsedThisCall = usage.total_tokens || usage.prompt_tokens + usage.completion_tokens || currentMaxTokens;
        }
        lastGroqCallTime = Date.now();
        lastGroqTokensUsed = tokensUsedThisCall;
        console.log(`[Groq] Tokens used: ${tokensUsedThisCall} (prompt=${usage?.prompt_tokens}, completion=${usage?.completion_tokens})`);

        if (content && content.trim().length > 0) {
          console.log(`[Groq] SUCCESS: ${content.length} chars (finish=${finishReason})`);
          return { content: content.trim() };
        }

        lastErr = `Empty response (finish_reason=${finishReason})`;
        console.warn(`[Groq] Empty content, retrying...`);
        if (attempt < 2) {
          await sleep(2000);
          continue;
        }
      } else {
        const errorBody = await response.text().catch(() => '');
        lastErr = `HTTP ${response.status}: ${errorBody.slice(0, 300)}`;
        console.error(`[Groq] Error: ${lastErr}`);
        lastGroqCallTime = Date.now();
        lastGroqTokensUsed = currentMaxTokens;

        // 413: Request too large — halve max_tokens and retry immediately
        if (response.status === 413) {
          const reduced = Math.max(Math.floor(currentMaxTokens / 2), 1024);
          if (reduced < currentMaxTokens) {
            console.log(`[Groq] 413 Request too large, reducing max_tokens: ${currentMaxTokens} -> ${reduced}`);
            currentMaxTokens = reduced;
            lastGroqCallTime = Date.now();
            lastGroqTokensUsed = currentMaxTokens;
            if (attempt < 2) continue;
          }
          throw new AIProviderError('Groq', new Error(lastErr), attempt + 1);
        }
        // Non-retryable
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          throw new AIProviderError('Groq', new Error(lastErr), attempt + 1);
        }
        // Retryable: 429 (rate limit — wait longer), 500, 502, 503
        if (attempt < 2) {
          const is429 = response.status === 429;
          const delay = is429 ? 20_000 * (attempt + 1) : 3000 * Math.pow(2, attempt);
          console.log(`[Groq] ${is429 ? 'Rate limited' : 'Retryable error'}, waiting ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }
      }
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      lastErr = error instanceof Error ? error.message : String(error);
      console.error(`[Groq] Attempt ${attempt + 1} error: ${lastErr.slice(0, 300)}`);
      const isRetryable = lastErr.includes('429') || lastErr.includes('413') || lastErr.includes('timeout') || lastErr.includes('ECONNRESET')
        || lastErr.includes('503') || lastErr.includes('502') || lastErr.includes('500');
      const is429 = lastErr.includes('429');
      const is413 = lastErr.includes('413');
      if (is413 && attempt < 2) {
        const reduced = Math.max(Math.floor(currentMaxTokens / 2), 1024);
        if (reduced < currentMaxTokens) {
          console.log(`[Groq] 413 in catch, reducing max_tokens: ${currentMaxTokens} -> ${reduced}`);
          currentMaxTokens = reduced;
        }
      }
      if (attempt < 2 && isRetryable) {
        const delay = is429 ? 20_000 * (attempt + 1) : 3000 * Math.pow(2, attempt);
        console.log(`[Groq] ${is429 ? 'Rate limited' : 'Error'}, waiting ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
    }
  }

  throw new AIProviderError('Groq', new Error(lastErr), 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART CHAT COMPLETION — Entry point for all AI calls
// ONLY uses Groq. No ZAI, no fallback chains.
// ═══════════════════════════════════════════════════════════════════════════

export async function smartChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
) {
  console.log(`[AI] smartChatCompletion (maxTokens: ${options?.maxTokens ?? 'default'}, temperature: ${options?.temperature ?? 'default'})`);

  const result = await callGroq(messages, options);
  return { content: result.content, provider: 'groq' as const };
}
