// Narration. Captions are always on; voice is optional:
//   off       – captions and music only (default)
//   browser   – the browser's built-in speech (free, live playback only)
//   clips     – pre-rendered clips (data: URLs) made by the web tool with the
//               viewer's own ElevenLabs or OpenAI key; these also go into the MP4.

export function speakBrowser(text) {
  if (!('speechSynthesis' in globalThis) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  const en = speechSynthesis.getVoices().find((v) => /en[-_](US|GB|AU)/i.test(v.lang) && /natural|premium|enhanced|samantha|daniel|karen/i.test(v.name));
  if (en) u.voice = en;
  speechSynthesis.speak(u);
}

export function stopBrowser() {
  if ('speechSynthesis' in globalThis) speechSynthesis.cancel();
}

/** Decode data: URL clips into AudioBuffers (null where missing). */
export async function decodeClips(ctx, clips = []) {
  return Promise.all(
    clips.map(async (url) => {
      if (!url) return null;
      try {
        const bytes = await (await fetch(url)).arrayBuffer();
        return await ctx.decodeAudioData(bytes);
      } catch {
        return null;
      }
    }),
  );
}

/**
 * Fetch narration for each caption with the viewer's own key (web tool only).
 * @param {'elevenlabs'|'openai'} provider
 * @returns {Promise<string[]>} data: URLs (audio/mpeg)
 */
export async function synthesizeClips(provider, key, captions, { voiceId = 'JBFqnCBsd6RMkjVDRZzb' } = {}) {
  const out = [];
  for (const text of captions) {
    let res;
    if (provider === 'elevenlabs') {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      });
    } else {
      res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'sage', input: text, response_format: 'mp3', instructions: 'Calm, warm, unhurried explainer narrator.' }),
      });
    }
    if (!res.ok) throw new Error(`${provider} voice failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    out.push(`data:audio/mpeg;base64,${btoa(bin)}`);
  }
  return out;
}
