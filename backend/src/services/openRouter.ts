import { config } from '../config';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': config.publicAppUrl,
    'X-Title': 'Nexora Fusion',
  };
}

export function isOpenRouterConfigured() {
  return Boolean(config.openRouterApiKey);
}

export async function completeWithOpenRouter(messages: AiChatMessage[], model = config.openRouterModel) {
  if (!config.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : '';
}

export async function streamWithOpenRouter(
  messages: AiChatMessage[],
  onText: (text: string) => void,
  model = config.openRouterModel
) {
  if (!config.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter failed (${response.status}): ${detail}`);
  }

  if (!response.body) {
    throw new Error('OpenRouter returned an empty response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      const chunk = JSON.parse(data);
      const text = chunk?.choices?.[0]?.delta?.content;
      if (typeof text === 'string' && text.length > 0) {
        onText(text);
      }
    }
  }
}
