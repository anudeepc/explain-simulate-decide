// AI providers. The key stays in this browser tab and is sent only to the
// provider the user picked. No server of ours is involved.

export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    needsKey: true,
    keyHint: 'sk-ant-…',
  },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', models: ['gpt-5', 'gpt-5-mini'], needsKey: true, keyHint: 'sk-…' },
  openrouter: { label: 'OpenRouter (has free models)', base: 'https://openrouter.ai/api/v1', models: ['openai/gpt-oss-120b:free', 'deepseek/deepseek-chat-v3.1:free'], needsKey: true, keyHint: 'sk-or-…' },
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'], needsKey: true, keyHint: 'gsk_…' },
  ollama: { label: 'Ollama (local, free)', base: 'http://localhost:11434/v1', models: ['qwen3:14b', 'llama3.1:8b'], needsKey: false, keyHint: 'not needed' },
  custom: { label: 'Other OpenAI-compatible', base: '', models: [], needsKey: false, keyHint: 'if required' },
  demo: { label: 'Demo (no key: loads the solar example)', models: ['example'], needsKey: false, keyHint: 'not needed' },
};

/**
 * Send a conversation and return the assistant's text.
 * @param {{provider: string, model: string, key?: string, base?: string}} cfg
 * @param {string} system
 * @param {{role: 'user'|'assistant', content: string}[]} messages
 */
export async function complete(cfg, system, messages) {
  if (cfg.provider === 'demo') {
    const res = await fetch(new URL('../examples/solar/screenplay.json', import.meta.url));
    return res.text();
  }
  if (cfg.provider === 'anthropic') return anthropic(cfg, system, messages);
  return openaiCompatible(cfg, system, messages);
}

async function anthropic({ model, key }, system, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      // if a request is declined by a safety check, the API retries on a suitable fallback model
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      system,
      messages,
      fallbacks: 'default',
      ...(model.startsWith('claude-haiku') ? {} : { output_config: { effort: 'medium' } }),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude: ${data?.error?.message || res.status}`);
  if (data.stop_reason === 'refusal') throw new Error('Claude declined this article. Try a different article or model.');
  if (data.stop_reason === 'max_tokens') throw new Error('The answer was cut off (too long). Try a shorter article.');
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function openaiCompatible({ provider, model, key, base }, system, messages) {
  const url = (base || PROVIDERS[provider]?.base || '').replace(/\/$/, '') + '/chat/completions';
  if (!/^https?:\/\//.test(url)) throw new Error('Enter the provider’s base URL, e.g. https://…/v1');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 12000, temperature: 0.4 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${PROVIDERS[provider]?.label || 'Provider'}: ${data?.error?.message || res.status}`);
  return data.choices?.[0]?.message?.content || '';
}
