import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type AIProvider = "zai" | "google" | "openai" | "groq" | "free";

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

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return { provider: "groq", label: "Groq (GPT-OSS 120B)", isFree: true, hasApiKey: true, model: "openai/gpt-oss-120b" };
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
      return { provider: "groq", label: "Groq (GPT-OSS 120B)", isFree: true, hasApiKey: true, model: "openai/gpt-oss-120b" };
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
    const summary = providerErrors.map((e) => `${e.provider}: ${e.error.slice(0, 100)}`).join(' | ');
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

async function callGroq(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ content: string } | null> {
  const models = ['openai/gpt-oss-120b'];

  return retryWithBackoff(async () => {
    for (const model of models) {
      try {
        const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, temperature: options?.temperature ?? 0.7, max_tokens: options?.maxTokens ?? 8192 }),
          timeoutMs: EXTERNAL_API_TIMEOUT,
        });
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content && content.trim().length > 0) return { content: content.trim() };
          console.warn(`[Groq] Model ${model}: empty response`);
        } else {
          const errorBody = await response.text().catch(() => '');
          console.error(`[Groq] Model ${model} failed (${response.status}): ${errorBody.slice(0, 300)}`);
          if (response.status === 404) continue;
          throw new Error(`Groq ${model} HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('404')) continue;
        throw error;
      }
    }
    return null;
  }, 'Groq', 3);
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

  // Priority 2: Groq
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

  // Priority 3: OPENAI_API_KEY (Gemini or OpenAI)
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
