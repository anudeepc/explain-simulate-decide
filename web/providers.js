// AI providers. The key stays in this browser tab and is sent only to the
// provider the user picked. No server of ours is involved.
// Replies are streamed, so the page can show what is happening while the AI writes.

export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    short: 'Claude',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    needsKey: true,
    keyHint: 'sk-ant-…',
  },
  openai: { label: 'OpenAI', short: 'OpenAI', base: 'https://api.openai.com/v1', models: ['gpt-5', 'gpt-5-mini'], needsKey: true, keyHint: 'sk-…' },
  openrouter: { label: 'OpenRouter (has free models)', short: 'OpenRouter', base: 'https://openrouter.ai/api/v1', models: ['openai/gpt-oss-120b:free', 'deepseek/deepseek-chat-v3.1:free'], needsKey: true, keyHint: 'sk-or-…' },
  groq: { label: 'Groq', short: 'Groq', base: 'https://api.groq.com/openai/v1', models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'], needsKey: true, keyHint: 'gsk_…' },
  ollama: { label: 'Ollama (local, free)', short: 'Ollama', base: 'http://localhost:11434/v1', models: ['qwen3:14b', 'llama3.1:8b'], needsKey: false, keyHint: 'not needed' },
  custom: { label: 'Other OpenAI-compatible', short: 'the provider', base: '', models: [], needsKey: false, keyHint: 'if required' },
  demo: { label: 'Demo (no key: loads the solar example)', short: 'the demo', models: ['example'], needsKey: false, keyHint: 'not needed' },
};

/**
 * @typedef {{kind: 'open'|'alive'|'text'|'thinking', text?: string}} StreamEvent
 *   open: the provider accepted the request; alive: bytes arrived (keep-alive pings count);
 *   text: part of the answer; thinking: part of the model's progress notes.
 */

/**
 * Send a conversation and return the assistant's full text.
 * @param {{provider: string, model: string, key?: string, base?: string}} cfg
 * @param {string} system
 * @param {{role: 'user'|'assistant', content: string}[]} messages
 * @param {{signal?: AbortSignal, onEvent?: (e: StreamEvent) => void}} [opts]
 */
export async function complete(cfg, system, messages, opts = {}) {
  const on = opts.onEvent || (() => {});
  if (cfg.provider === 'demo') return demo(opts.signal, on);
  if (cfg.provider === 'anthropic') return anthropic(cfg, system, messages, opts.signal, on);
  return openaiCompatible(cfg, system, messages, opts.signal, on);
}

/** The demo streams the bundled solar screenplay, so the progress display can be seen without a key. */
async function demo(signal, on) {
  const res = await fetch(new URL('../examples/solar/screenplay.json', import.meta.url), { signal });
  const text = await res.text();
  on({ kind: 'open' });
  const wait = (ms) => new Promise((ok, no) => {
    const t = setTimeout(ok, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), no(signal.reason)), { once: true });
  });
  on({ kind: 'thinking', text: 'Loading the solar example instead of asking an AI.' });
  await wait(900);
  for (let i = 0; i < text.length; i += 350) {
    await wait(80);
    on({ kind: 'text', text: text.slice(i, i + 350) });
  }
  return text;
}

/** Read a Server-Sent Events body and call back with each parsed data object. */
async function readSse(res, onData, onAlive) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onAlive();
    buf += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buf.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buf.slice(0, cut);
      buf = buf.slice(cut).replace(/^\r?\n\r?\n/, '');
      const data = chunk.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') continue;
      let ev;
      try {
        ev = JSON.parse(data);
      } catch {
        continue; // ignore a malformed line rather than fail the whole answer
      }
      onData(ev);
    }
  }
}

const isStream = (res) => (res.headers.get('content-type') || '').includes('text/event-stream');

async function anthropic({ model, key }, system, messages, signal, on) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
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
      max_tokens: 64000,
      stream: true,
      system,
      messages,
      fallbacks: 'default',
      // summarized thinking streams short readable notes, so the page can show what Claude is working on
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'medium' },
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Claude: ${data?.error?.message || res.status}`);
  }
  on({ kind: 'open' });
  let text = '';
  let stop = null;
  if (!isStream(res)) {
    // a proxy (or a test) may answer without streaming
    const data = await res.json();
    stop = data.stop_reason;
    text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    on({ kind: 'text', text });
  } else {
    await readSse(
      res,
      (ev) => {
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          text += ev.delta.text;
          on({ kind: 'text', text: ev.delta.text });
        } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'thinking_delta') {
          on({ kind: 'thinking', text: ev.delta.thinking });
        } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) {
          stop = ev.delta.stop_reason;
        } else if (ev.type === 'error') {
          throw new Error(`Claude: ${ev.error?.message || 'the stream reported an error'}`);
        }
      },
      () => on({ kind: 'alive' }),
    );
  }
  if (stop === 'refusal') throw new Error('Claude declined this article. Try a different article or model.');
  if (stop === 'max_tokens') throw new Error('The answer was cut off because it was too long. Try a shorter article.');
  return text;
}

async function openaiCompatible({ provider, model, key, base }, system, messages, signal, on) {
  const url = (base || PROVIDERS[provider]?.base || '').replace(/\/$/, '') + '/chat/completions';
  if (!/^https?:\/\//.test(url)) throw new Error('Enter the provider’s base URL, for example https://…/v1');
  const name = PROVIDERS[provider]?.label || 'Provider';
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 12000, temperature: 0.4, stream: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`${name}: ${data?.error?.message || res.status}`);
  }
  on({ kind: 'open' });
  if (!isStream(res)) {
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    on({ kind: 'text', text });
    return text;
  }
  let text = '';
  await readSse(
    res,
    (ev) => {
      if (ev.error) throw new Error(`${name}: ${ev.error.message || 'the stream reported an error'}`);
      const d = ev.choices?.[0]?.delta || {};
      const thought = d.reasoning_content || d.reasoning;
      if (typeof thought === 'string' && thought) on({ kind: 'thinking', text: thought });
      if (d.content) {
        text += d.content;
        on({ kind: 'text', text: d.content });
      }
    },
    () => on({ kind: 'alive' }),
  );
  return text;
}
