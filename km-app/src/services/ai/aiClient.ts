import type { AIClientConfig } from '../../types';

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

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const { provider, apiKey, model, baseURL } = config;

  if (!apiKey) {
    throw new Error('API key not configured. Please set your API key in settings.');
  }

  const url = baseURL
    ? `${baseURL}/v1/messages`
    : provider === 'anthropic'
    ? 'https://api.anthropic.com/v1/messages'
    : 'https://api.openai.com/v1/chat/completions';

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
  options?: { temperature?: number }
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
