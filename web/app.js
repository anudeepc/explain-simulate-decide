// The upload tool: article → AI screenplay → validated → directed film.
import { readFile, readUrl, prepare } from './article.js';
import { PROVIDERS, complete } from './providers.js';
import { systemPrompt, articleMessage, repairMessage, extractJson } from './prompt.js';
import { validate } from '../skills/explain-simulate-decide/engine/schema.js';
import { mount } from '../skills/explain-simulate-decide/engine/player.js';
import { inline } from '../skills/explain-simulate-decide/engine/bundle.js';
import { toHtml } from '../skills/explain-simulate-decide/engine/export.js';
import { synthesizeClips } from '../skills/explain-simulate-decide/engine/voice.js';

const $ = (id) => document.getElementById(id);
const ENGINE = new URL('../skills/explain-simulate-decide/engine/', import.meta.url);
const MAX_REPAIRS = 2;

let screenplay = null;
let player = null;
let voiceClips = null;

// ---- provider picker
for (const [id, p] of Object.entries(PROVIDERS)) $('provider').append(new Option(p.label, id));
const saved = JSON.parse(localStorage.getItem('esd-settings') || '{}');
$('provider').value = saved.provider || 'demo';
$('remember').checked = !!saved.key;

function syncProvider() {
  const p = PROVIDERS[$('provider').value];
  $('models').replaceChildren(...p.models.map((m) => new Option(m, m)));
  $('model').value = saved.provider === $('provider').value && saved.model ? saved.model : p.models[0] || '';
  $('key').placeholder = `API key (${p.keyHint})`;
  $('key').disabled = !p.needsKey && $('provider').value !== 'custom';
  $('base').hidden = $('provider').value !== 'custom';
  $('key').value = sessionStorage.getItem(`esd-key-${$('provider').value}`) || (saved.provider === $('provider').value ? saved.key || '' : '');
}
$('provider').addEventListener('change', syncProvider);
syncProvider();
$('key').addEventListener('input', () => sessionStorage.setItem(`esd-key-${$('provider').value}`, $('key').value));
$('voice').addEventListener('change', () => ($('voiceKey').hidden = !['elevenlabs', 'openai'].includes($('voice').value)));

function saveSettings() {
  const s = { provider: $('provider').value, model: $('model').value };
  if ($('remember').checked) s.key = $('key').value;
  localStorage.setItem('esd-settings', JSON.stringify(s));
}

// ---- article input
$('file').addEventListener('change', async () => {
  const f = $('file').files[0];
  if (!f) return;
  info(`Reading ${f.name}…`);
  try {
    $('article').value = await readFile(f);
    describeArticle();
  } catch (e) {
    info(`Could not read that file: ${e.message}`);
  }
});
$('fetchUrl').addEventListener('click', async () => {
  const url = $('url').value.trim();
  if (!/^https?:\/\//.test(url)) return info('Enter a full URL starting with https://');
  info('Fetching…');
  try {
    $('article').value = await readUrl(url);
    describeArticle();
  } catch (e) {
    info(e.message);
  }
});
$('article').addEventListener('input', describeArticle);
function describeArticle() {
  const { text, trimmed } = prepare($('article').value);
  info(text ? `${text.split(/\s+/).length.toLocaleString()} words${trimmed ? ' (long: only the first part will be used)' : ''}.` : '');
}
function info(t) {
  $('articleInfo').textContent = t;
}

// ---- log
function log(text, err = false) {
  const li = document.createElement('li');
  li.textContent = text;
  if (err) li.className = 'err';
  $('log').append(li);
  return li;
}

// ---- generate
$('generate').addEventListener('click', generate);
async function generate() {
  const provider = $('provider').value;
  const cfg = { provider, model: $('model').value.trim(), key: $('key').value.trim(), base: $('base').value.trim() };
  const { text, trimmed } = prepare($('article').value);
  $('log').replaceChildren();
  if (provider !== 'demo' && text.length < 200) return log('Add an article first (at least a few paragraphs).', true);
  if (PROVIDERS[provider].needsKey && !cfg.key) return log(`Add your ${PROVIDERS[provider].label} API key.`, true);
  if (['elevenlabs', 'openai'].includes($('voice').value) && !$('voiceKey').value.trim()) return log('Add your voice API key, or set Voice to Off.', true);
  saveSettings();
  $('generate').disabled = true;
  try {
    const system = await systemPrompt();
    const messages = [{ role: 'user', content: articleMessage(text, trimmed) }];
    let sp = null;
    for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
      const step = log(attempt === 0 ? 'Reading the article and writing the screenplay…' : `Fixing ${'problems'} (attempt ${attempt} of ${MAX_REPAIRS})…`);
      const reply = await complete(cfg, system, messages);
      messages.push({ role: 'assistant', content: reply });
      let errors;
      try {
        sp = extractJson(reply);
        errors = validate(sp);
      } catch (e) {
        errors = [`Reply was not valid JSON: ${e.message}`];
      }
      if (!errors.length) {
        step.textContent += ' done.';
        break;
      }
      step.textContent += ` ${errors.length} problem(s) found.`;
      if (attempt === MAX_REPAIRS) {
        errors.forEach((e) => log(e, true));
        log('Still not valid. Try again, pick a stronger model, or fix it in “Edit screenplay”.', true);
        screenplay = sp;
        showEditor(sp);
        return;
      }
      messages.push({ role: 'user', content: repairMessage(errors) });
    }
    screenplay = sp;
    voiceClips = null;
    const voice = $('voice').value;
    if (voice === 'elevenlabs' || voice === 'openai') {
      const v = log('Recording narration with your voice key…');
      voiceClips = await synthesizeClips(voice, $('voiceKey').value.trim(), sp.explain.map((s) => s.caption));
      v.textContent += ' done.';
    }
    await render();
    log(`Ready: “${sp.question}”. Press Play, then try the model.`);
  } catch (e) {
    log(e.message || String(e), true);
  } finally {
    $('generate').disabled = false;
  }
}

function playerOptions() {
  const voice = $('voice').value;
  return {
    cast: $('cast').value,
    voice: voiceClips ? 'clips' : voice === 'browser' ? 'browser' : 'off',
    ...(voiceClips ? { voiceClips } : {}),
  };
}

async function render() {
  $('result').hidden = false;
  $('json').value = JSON.stringify(screenplay, null, 2);
  player = mount($('stage'), screenplay, playerOptions());
  await player.ready;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showEditor(sp) {
  $('result').hidden = false;
  $('editor').hidden = false;
  $('json').value = JSON.stringify(sp, null, 2);
}

// ---- outputs
const slug = () => (screenplay?.question || 'explainer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

$('dlHtml').addEventListener('click', async () => {
  if (!screenplay) return;
  const b = log('Packing one offline HTML file…');
  try {
    const bundle = await inline('player.js', async (p) => (await fetch(new URL(p, ENGINE))).text());
    const html = toHtml(screenplay, bundle, { options: playerOptions() });
    download(new Blob([html], { type: 'text/html' }), `${slug()}.html`);
    b.textContent += ' done.';
  } catch (e) {
    log(`Could not pack the file: ${e.message}`, true);
  }
});
$('dlJson').addEventListener('click', () => screenplay && download(new Blob([JSON.stringify(screenplay, null, 2)], { type: 'application/json' }), `${slug()}.screenplay.json`));
$('dlMp4').addEventListener('click', async () => {
  if (!player?.record) return;
  $('dlMp4').disabled = true;
  const l = log('Recording MP4 (1080p, 60 fps)… 0%');
  try {
    const blob = await player.record({ onProgress: (p) => (l.textContent = `Recording MP4 (1080p, 60 fps)… ${Math.round(p * 100)}%`) });
    download(blob, `${slug()}.mp4`);
    l.textContent += ' done.';
  } catch (e) {
    log(`Could not record: ${e.message}`, true);
  } finally {
    $('dlMp4').disabled = false;
  }
});
$('toggleEdit').addEventListener('click', () => ($('editor').hidden = !$('editor').hidden));
$('rerender').addEventListener('click', async () => {
  let sp;
  try {
    sp = JSON.parse($('json').value);
  } catch (e) {
    return log(`Not valid JSON: ${e.message}`, true);
  }
  const errors = validate(sp);
  if (errors.length) return errors.forEach((e) => log(e, true));
  screenplay = sp;
  await render();
  log('Re-rendered.');
});

// expose for automated checks
window.ESDTool = { generate, get player() { return player; }, get screenplay() { return screenplay; } };
