// The upload tool: article → AI screenplay → validated → directed film.
import { readFile, readUrl, prepare } from './article.js';
import { PROVIDERS, complete } from './providers.js';
import { systemPrompt, articleMessage, repairMessage, extractJson } from './prompt.js';
import { createProgress, clock } from './progress.js';
import { validate } from '../skills/explain-simulate-decide/engine/schema.js';
import { mount } from '../skills/explain-simulate-decide/engine/player.js';
import { inline } from '../skills/explain-simulate-decide/engine/bundle.js';
import { toHtml } from '../skills/explain-simulate-decide/engine/export.js';
import { synthesizeClips } from '../skills/explain-simulate-decide/engine/voice.js';

const $ = (id) => document.getElementById(id);
const ENGINE = new URL('../skills/explain-simulate-decide/engine/', import.meta.url);
const MAX_REPAIRS = 2;
// watchdog: warn when the provider goes quiet, stop when it is clearly stuck
const QUIET_WARN = 45_000; // no new text, but the connection is open
const SILENT_WARN = 60_000; // nothing at all has arrived
const SILENT_STOP = 240_000;
const WAIT_WARN = 25_000; // the provider hasn't accepted the request yet
const MAX_TOTAL = 15 * 60_000;
const EXPECTED_CHARS = 12_000; // a typical screenplay; only a rough guide for the bar

let screenplay = null;
let player = null;
let voiceClips = null;
let running = null; // AbortController of the job in progress

// ---- the live scene at the top of the page
(async () => {
  try {
    const sp = await (await fetch(new URL('../examples/solar/screenplay.json', import.meta.url))).json();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    mount($('hero'), sp, { autoplay: !still, music: false });
  } catch {
    $('hero').textContent = 'The live demo could not load here. Open it full screen instead.';
  }
})();

// ---- provider picker
for (const [id, p] of Object.entries(PROVIDERS)) $('provider').append(new Option(p.label, id));
const saved = JSON.parse(localStorage.getItem('esd-settings') || '{}');
$('provider').value = PROVIDERS[saved.provider] ? saved.provider : 'demo';
$('remember').checked = !!saved.key;

function syncProvider() {
  const id = $('provider').value;
  const p = PROVIDERS[id];
  $('models').replaceChildren(...p.models.map((m) => new Option(m, m)));
  $('model').value = saved.provider === id && saved.model ? saved.model : p.models[0] || '';
  $('key').placeholder = p.keyHint;
  $('key').disabled = !p.needsKey && id !== 'custom';
  $('baseField').hidden = id !== 'custom';
  $('key').value = sessionStorage.getItem(`esd-key-${id}`) || (saved.provider === id ? saved.key || '' : '');
}
$('provider').addEventListener('change', syncProvider);
syncProvider();
$('key').addEventListener('input', () => sessionStorage.setItem(`esd-key-${$('provider').value}`, $('key').value));
$('voice').addEventListener('change', () => ($('voiceKeyField').hidden = !['elevenlabs', 'openai'].includes($('voice').value)));

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
    describeArticle(f.name);
  } catch (e) {
    info(`Could not read ${f.name}: ${e.message}`);
  }
});
$('fetchUrl').addEventListener('click', async () => {
  const url = $('url').value.trim();
  if (!/^https?:\/\//.test(url)) return info('Enter a full link starting with https://');
  info('Fetching the page…');
  try {
    $('article').value = await readUrl(url);
    describeArticle();
  } catch (e) {
    info(e.message);
  }
});
$('article').addEventListener('input', () => describeArticle());
const wordCount = (t) => (t ? t.split(/\s+/).length : 0);
function describeArticle(from) {
  const { text, trimmed } = prepare($('article').value);
  const n = wordCount(text);
  info(n ? `${n.toLocaleString()} words${from ? ` from ${from}` : ''}${trimmed ? '. It is long, so only the first part will be used.' : '.'}` : '');
}
function info(t) {
  $('articleInfo').textContent = t;
}

// ---- making the explainer
const progress = createProgress($('progress'), 'Making the explainer');
$('progress').hidden = true;
$('generate').addEventListener('click', generate);
$('cancel').addEventListener('click', () => running?.abort(new Error('stopped')));

/** Find which top-level part of the screenplay JSON the AI is writing, as text streams in. */
function sectionWatcher() {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let buf = '';
  let pending = null;
  let section = null;
  let started = false;
  return {
    feed(chunk) {
      for (const ch of chunk) {
        if (!started) {
          if (ch !== '{') continue;
          started = true;
        }
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') {
            inStr = false;
            if (depth === 1) pending = buf;
          } else if (depth === 1) buf += ch;
          continue;
        }
        if (ch === '"') {
          inStr = true;
          buf = '';
        } else if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
        else if (ch === ':' && depth === 1 && pending !== null) {
          section = pending;
          pending = null;
        } else if (ch === ',') pending = null;
      }
      return section;
    },
  };
}
const SECTIONS = {
  version: [0, 'Starting the screenplay'],
  shape: [0.01, 'Choosing the story’s shape'],
  question: [0.02, 'Framing the decision'],
  source: [0.05, 'Quoting the article’s numbers'],
  model: [0.18, 'Writing the model: inputs, formulas and what builds up over time'],
  world: [0.45, 'Building the world: the things and the flows between them'],
  checks: [0.56, 'Writing checks against what the source says'],
  ask: [0.6, 'Writing the questions the page will ask you'],
  explain: [0.7, 'Writing the shots for the film'],
  simulate: [0.84, 'Choosing the controls you can move'],
  decide: [0.88, 'Writing the trade-offs, the limits and questions to ask'],
};

/** Turn streaming events into progress, and watch for a provider that has gone quiet. */
function watchWriting(stepId, who, ac) {
  const t0 = performance.now();
  let opened = false;
  let lastAlive = t0;
  let lastText = t0;
  let chars = 0;
  let notes = '';
  let section = null;
  const watcher = sectionWatcher();
  const showChars = () => progress.detail(stepId, chars ? `${(chars / 1000).toFixed(1)}k characters so far` : '');
  const tick = setInterval(() => {
    const now = performance.now();
    if (now - t0 > MAX_TOTAL) return ac.abort(new Error(`This took longer than ${clock(MAX_TOTAL)}, so it was stopped. Try again, or pick a faster model.`));
    if (!opened) {
      progress.within(Math.min(0.04, (now - t0) / 600_000));
      progress.warn(now - t0 > WAIT_WARN ? `${who} hasn’t started answering after ${clock(now - t0)}. Busy services sometimes queue requests. You can keep waiting or press Stop.` : null);
      return;
    }
    if (now - lastAlive > SILENT_STOP) return ac.abort(new Error(`Nothing arrived from ${who} for ${clock(SILENT_STOP)}, so the request was stopped. Try again, or pick another model.`));
    if (now - lastAlive > SILENT_WARN) progress.warn(`Nothing has arrived from ${who} for ${clock(now - lastAlive)}. It may be stuck. Keep waiting or press Stop. It stops by itself at ${clock(SILENT_STOP)}.`);
    else if (now - lastText > QUIET_WARN) progress.warn(`No new text for ${clock(now - lastText)}, but the connection is still open, so ${who} is still working.`);
    else progress.warn(null);
    if (!chars) progress.within(Math.min(0.12, 0.04 + (now - t0) / 900_000)); // thinking: creep, so the bar is never frozen
  }, 1000);
  return {
    on(e) {
      const now = performance.now();
      lastAlive = now;
      if (e.kind === 'open' && !opened) {
        opened = true;
        progress.status(`${who} is reading the article and planning the screenplay.`);
      } else if (e.kind === 'thinking' && e.text) {
        lastText = now;
        notes = (notes + e.text).slice(-600);
        const lines = notes.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12);
        const last = lines.at(-1);
        if (last) progress.note(`${who}’s notes: ${last.length > 160 ? last.slice(0, 157) + '…' : last}`);
        if (!chars) progress.status(`${who} is thinking the article through before writing.`);
      } else if (e.kind === 'text' && e.text) {
        lastText = now;
        chars += e.text.length;
        const s = watcher.feed(e.text);
        if (s && s !== section && SECTIONS[s]) {
          section = s;
          progress.status(SECTIONS[s][1]);
        } else if (!section) progress.status('Writing the screenplay');
        const bySection = section ? SECTIONS[section][0] : 0;
        progress.within(0.12 + 0.86 * Math.max(bySection, Math.min(chars / EXPECTED_CHARS, 0.97)));
        showChars();
      }
    },
    stop() {
      clearInterval(tick);
      return chars;
    },
  };
}

/** Show a problem before any work starts. */
function refuse(message) {
  progress.start([]);
  progress.fail(message, 'blocked');
}

async function generate() {
  const provider = $('provider').value;
  const P = PROVIDERS[provider];
  const cfg = { provider, model: $('model').value.trim(), key: $('key').value.trim(), base: $('base').value.trim() };
  const { text, trimmed } = prepare($('article').value);
  if (provider !== 'demo' && text.length < 200) return refuse('Add an article first: paste a few paragraphs, upload a file or fetch a link.');
  if (P.needsKey && !cfg.key) return refuse(`Add your ${P.label} API key in Your AI.`);
  const voice = $('voice').value;
  const recordVoice = voice === 'elevenlabs' || voice === 'openai';
  if (recordVoice && !$('voiceKey').value.trim()) return refuse('Add your voice API key, or set Voice to Off.');
  saveSettings();

  const who = provider === 'anthropic' ? 'Claude' : provider === 'demo' ? 'The demo' : P.short;
  const ac = new AbortController();
  running = ac;
  $('generate').disabled = true;
  $('cancel').hidden = false;
  progress.start([
    { id: 'read', label: 'Read the article', weight: 1 },
    { id: 'rules', label: 'Load the skill’s rules', weight: 1 },
    { id: 'write', label: `Write the screenplay with ${provider === 'demo' ? 'the demo' : cfg.model || who}`, weight: 30 },
    { id: 'check', label: 'Check it against the rules', weight: 1 },
    ...(recordVoice ? [{ id: 'voice', label: 'Record the narration', weight: 6 }] : []),
    { id: 'build', label: 'Build the 3D world', weight: 3 },
  ]);
  $('progress').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    progress.step('read', 'Reading the article');
    progress.done('read', provider === 'demo' ? 'not needed for the demo' : `${wordCount(text).toLocaleString()} words${trimmed ? ', trimmed to fit' : ''}`);
    progress.step('rules', 'Loading the skill’s rules');
    const system = await systemPrompt();
    progress.done('rules');

    const messages = [{ role: 'user', content: articleMessage(text, trimmed) }];
    let sp = null;
    let after = 'check';
    for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
      const writeId = attempt ? `fix${attempt}` : 'write';
      const checkId = attempt ? `recheck${attempt}` : 'check';
      progress.step(writeId, `Sending the article to ${who}`);
      const watch = watchWriting(writeId, who, ac);
      let reply;
      let chars = 0;
      try {
        reply = await complete(cfg, system, messages, { signal: ac.signal, onEvent: watch.on });
      } finally {
        chars = watch.stop();
      }
      progress.done(writeId, `${(chars / 1000).toFixed(1)}k characters`);
      messages.push({ role: 'assistant', content: reply });
      progress.step(checkId, 'Checking the screenplay against the rules');
      let errors;
      try {
        sp = extractJson(reply);
        errors = validate(sp);
      } catch (e) {
        errors = [`The reply was not a valid screenplay: ${e.message}`];
      }
      if (!errors.length) {
        progress.done(checkId, 'passed every rule');
        progress.problems([]);
        break;
      }
      progress.done(checkId, `${errors.length} problem${errors.length > 1 ? 's' : ''} found`, 'warn');
      progress.problems(errors);
      if (attempt === MAX_REPAIRS) {
        screenplay = sp;
        showEditor(sp);
        progress.fail(`Still ${errors.length} problem${errors.length > 1 ? 's' : ''} after ${MAX_REPAIRS} fixes. Try again, pick a stronger model, or fix them in Edit screenplay below.`);
        return;
      }
      const n = errors.length;
      progress.add(after, { id: `fix${attempt + 1}`, label: `Fix ${n} problem${n > 1 ? 's' : ''} (try ${attempt + 1} of ${MAX_REPAIRS})`, weight: 15 });
      progress.add(`fix${attempt + 1}`, { id: `recheck${attempt + 1}`, label: 'Check again', weight: 1 });
      after = `recheck${attempt + 1}`;
      messages.push({ role: 'user', content: repairMessage(errors) });
    }

    screenplay = sp;
    voiceClips = null;
    if (recordVoice) {
      progress.step('voice', `Recording ${sp.explain.length} narration clips`);
      voiceClips = await synthesizeClips(voice, $('voiceKey').value.trim(), sp.explain.map((s) => s.caption));
      progress.done('voice', `${sp.explain.length} clips`);
    }
    progress.step('build', 'Building the 3D world and directing the film');
    progress.within(0.3);
    await render();
    progress.done('build');
    progress.finish(`Ready: “${sp.question}” Press Play, or Try the model.`);
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    const reason = ac.signal.aborted ? ac.signal.reason : e;
    if (reason?.message === 'stopped') progress.fail('Stopped. Nothing more was sent. Press Make the explainer to start again.', 'stopped');
    else progress.fail(reason?.message || String(reason));
  } finally {
    running = null;
    $('generate').disabled = false;
    $('cancel').hidden = true;
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
  player?.destroy?.();
  player = mount($('stage'), screenplay, playerOptions());
  await player.ready;
}

function showEditor(sp) {
  $('result').hidden = false;
  $('editor').hidden = false;
  $('toggleEdit').setAttribute('aria-expanded', 'true');
  $('json').value = JSON.stringify(sp, null, 2);
}

// ---- outputs
const exporting = createProgress($('exportProgress'), 'Preparing your file');
$('exportProgress').hidden = true;
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
  exporting.start([
    { id: 'pack', label: 'Pack the renderer and screenplay into one file', weight: 4 },
    { id: 'save', label: 'Save the HTML file', weight: 1 },
  ]);
  try {
    exporting.step('pack', 'Packing one offline HTML file');
    const bundle = await inline('player.js', async (p) => (await fetch(new URL(p, ENGINE))).text());
    const html = toHtml(screenplay, bundle, { options: playerOptions() });
    exporting.done('pack', `${(html.length / 1e6).toFixed(1)} MB`);
    exporting.step('save');
    download(new Blob([html], { type: 'text/html' }), `${slug()}.html`);
    exporting.done('save', `${slug()}.html`);
    exporting.finish('Saved. The file works offline in any modern browser.');
  } catch (e) {
    exporting.fail(`Could not pack the file: ${e.message}`);
  }
});
$('dlJson').addEventListener('click', () => screenplay && download(new Blob([JSON.stringify(screenplay, null, 2)], { type: 'application/json' }), `${slug()}.screenplay.json`));
$('dlMp4').addEventListener('click', async () => {
  if (!player?.record) return;
  $('dlMp4').disabled = true;
  exporting.start([
    { id: 'rec', label: 'Draw every frame at 1080p, 60 fps, and encode it', weight: 20 },
    { id: 'save', label: 'Save the MP4', weight: 1 },
  ]);
  try {
    exporting.step('rec', 'Recording the film frame by frame. Keep this tab open.');
    const blob = await player.record({
      onProgress: (p) => {
        exporting.within(p);
        exporting.status(`Recording the film frame by frame: ${Math.round(p * 100)}%. Keep this tab open.`);
      },
    });
    exporting.done('rec', `${(blob.size / 1e6).toFixed(1)} MB`);
    exporting.step('save');
    download(blob, `${slug()}.mp4`);
    exporting.done('save', `${slug()}.mp4`);
    exporting.finish('Saved the MP4.');
  } catch (e) {
    exporting.fail(`Could not record: ${e.message}`);
  } finally {
    $('dlMp4').disabled = false;
  }
});
$('toggleEdit').addEventListener('click', () => {
  $('editor').hidden = !$('editor').hidden;
  $('toggleEdit').setAttribute('aria-expanded', String(!$('editor').hidden));
});
$('rerender').addEventListener('click', async () => {
  let sp;
  exporting.start([
    { id: 'check', label: 'Check the screenplay against the rules', weight: 1 },
    { id: 'build', label: 'Build the 3D world', weight: 3 },
  ]);
  exporting.step('check');
  try {
    sp = JSON.parse($('json').value);
  } catch (e) {
    exporting.problems([`Not valid JSON: ${e.message}`]);
    return exporting.fail('The screenplay is not valid JSON.');
  }
  const errors = validate(sp);
  if (errors.length) {
    exporting.problems(errors);
    return exporting.fail(`${errors.length} problem${errors.length > 1 ? 's' : ''} to fix before it can play.`);
  }
  exporting.done('check', 'passed every rule');
  exporting.step('build');
  screenplay = sp;
  await render();
  exporting.done('build');
  exporting.finish('Playing your edited screenplay.');
});

// expose for automated checks
window.ESDTool = { generate, get player() { return player; }, get screenplay() { return screenplay; } };
