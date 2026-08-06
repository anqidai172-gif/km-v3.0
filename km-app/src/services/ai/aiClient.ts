import type { AIClientConfig } from '../../types';
import { getAIConfig as getStoredAIConfig } from './aiConfigStore';

const DEFAULT_CONFIG: AIClientConfig = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
};

let config: AIClientConfig = { ...DEFAULT_CONFIG };

export function configureAIClient(newConfig: Partial<AIClientConfig>): void {
  config = { ...config, ...newConfig };
}

export function getAIConfig(): AIClientConfig {
  return { ...config };
}

export interface AICallOptions {
  temperature?: number;
  maxTokens?: number;
  /** Override global config — pass apiKey/baseURL/model directly */
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: AICallOptions
): Promise<string> {
  // 1. Passed-in options → 2. aiConfigStore (set by settings store) → 3. legacy global config
  const storeCfg = getStoredAIConfig();
  const apiKey = options?.apiKey || storeCfg.apiKey || config.apiKey;
  const baseURL = options?.baseURL || storeCfg.baseURL || config.baseURL;
  const model = options?.model || storeCfg.model || config.model;
  const provider: 'anthropic' | 'openai' = /anthropic/i.test(baseURL || '') ? 'anthropic' : 'openai';

  console.log('[callAI] resolve:', JSON.stringify({
    optKey: String(options?.apiKey || '').slice(0, 8) + '...',
    storeKey: String(storeCfg.apiKey).slice(0, 8) + '...',
    globalKey: String(config.apiKey).slice(0, 8) + '...',
    finalKeyLen: apiKey.length,
    baseURL,
    model,
  }));

  if (!apiKey) {
    console.log('[callAI] ❌ No API key — all sources empty');
    throw new Error('API key not configured. Please set your API key in settings.');
  }

  // Build the correct URL — normalize baseURL to avoid double /v1
  const normalizedBase = (baseURL || '')
    .replace(/\/+$/, '')        // strip trailing slashes
    .replace(/\/v1\/?$/, '');   // strip trailing /v1 so we can add it back cleanly

  let url: string;
  if (provider === 'anthropic') {
    url = baseURL
      ? `${normalizedBase}/v1/messages`
      : 'https://api.anthropic.com/v1/messages';
  } else {
    url = baseURL
      ? `${normalizedBase}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let body: any;

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
    };
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
    body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
    };
  }

  console.log('[callAI] 🚀 sending request to:', url, 'model:', model);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (provider === 'anthropic') {
    return data.content?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

export async function callAIWithJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options?: AICallOptions,
): Promise<T> {
  const jsonPrompt = `${systemPrompt}\n\nYou must respond with valid JSON only. No other text.`;
  const response = await callAI(jsonPrompt, userMessage, { ...options, maxTokens: 4096 });
  try {
    return JSON.parse(response) as T;
  } catch {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}
