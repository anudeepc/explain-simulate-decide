// The live controls: player bar, "Make it yours" questions, Simulate dock, Decide
// panel, error panel. Built with createElement + textContent only: screenplay text
// is never HTML. Sizes follow the player's own box (container units), not the window.
import { formatValue } from './model.js';
import { quoteText } from './schema.js';

const CSS = `
.esd{position:absolute;inset:0;container-type:size;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,"Helvetica Neue",Arial,sans-serif;color:#26262b;user-select:none}
.esd canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.esd-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;background:rgba(251,247,239,.92);border-radius:999px;padding:6px 10px;box-shadow:0 6px 24px rgba(60,40,20,.14);backdrop-filter:blur(6px);transition:opacity .3s;max-width:96cqw}
.esd-bar.dim{opacity:.25}.esd-bar:hover{opacity:1}
.esd button{white-space:nowrap;font:inherit;font-size:13px;font-weight:600;border:0;border-radius:999px;padding:7px 13px;background:transparent;color:#26262b;cursor:pointer}
.esd button:hover{background:rgba(0,0,0,.06)}
.esd button.primary{background:#26262b;color:#fff}.esd button.primary:hover{background:#000}
.esd button.chip{border:1.5px solid rgba(0,0,0,.14);margin:0 6px 6px 0}
.esd button.chip[aria-pressed=true]{background:#c0623f;border-color:#c0623f;color:#fff}
.esd button:focus-visible,.esd input:focus-visible{outline:2px solid #c0623f;outline-offset:2px}
.esd-scrub{width:min(30cqw,360px);accent-color:#c0623f}
.esd-time{font-size:12px;font-variant-numeric:tabular-nums;color:#6d6a66;min-width:76px;text-align:center}
.esd-panel{position:absolute;background:rgba(251,247,239,.96);border-radius:16px;box-shadow:0 10px 40px rgba(60,40,20,.16);padding:16px 18px;max-height:calc(100cqh - 90px);overflow:auto;user-select:text;box-sizing:border-box}
.esd-sim{left:2cqw;top:50%;transform:translateY(-50%);width:clamp(230px,27cqw,330px);padding:14px 16px}
.esd h2{margin:0 0 4px;font-size:17px}
.esd-panel p{margin:0 0 12px;color:#6d6a66;font-size:13px;line-height:1.45}
.esd-row{margin:0 0 11px}
.esd-row label{display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:3px;gap:8px}
.esd-row label span:last-child{font-variant-numeric:tabular-nums}
.esd-row input[type=range]{width:100%;accent-color:#c0623f;margin:0}
.esd-row small{color:#8a857e;font-size:11px}
.esd-out{border-top:1px solid rgba(0,0,0,.08);padding-top:10px;margin-top:4px}
.esd-out .esd-row label{font-weight:500}.esd-out .esd-row label span:last-child{font-weight:700}
.esd-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.esd-ask{left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,92cqw)}
.esd-q{margin:0 0 16px}.esd-q b{display:block;font-size:14px;margin-bottom:3px}.esd-q small{display:block;color:#8a857e;font-size:12px;margin-bottom:7px}
.esd-q input[type=number]{font:inherit;font-size:15px;padding:7px 10px;border-radius:10px;border:1.5px solid rgba(0,0,0,.15);width:150px;background:#fff}
.esd-decide{left:50%;top:50%;transform:translate(-50%,-50%);width:min(980px,94cqw)}
.esd-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:10px 0 12px}
.esd-cols h3,.esd-cmp caption{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#c0623f;margin:0 0 8px;text-align:left}
.esd-cols ul{margin:0;padding-left:16px;font-size:13.5px;line-height:1.5}.esd-cols li{margin-bottom:6px}
.esd-cmp{width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0 4px}
.esd-cmp th,.esd-cmp td{text-align:left;padding:6px 8px}.esd-cmp td{font-weight:700;font-variant-numeric:tabular-nums}
.esd-cmp tbody tr:nth-child(odd){background:rgba(0,0,0,.035)}.esd-cmp th[scope=row]{font-weight:600}
.esd-sources{border-top:1px solid rgba(0,0,0,.08);padding-top:10px;font-size:12px;color:#6d6a66}
.esd-sources blockquote{margin:6px 0;padding-left:10px;border-left:3px solid #e2a43b;font-style:italic}
.esd-sources a{color:#c0623f}
.esd-errors{left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,90cqw)}
.esd-errors li{font-family:ui-monospace,Menlo,monospace;font-size:12px;margin-bottom:4px}
.esd-progress{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(251,247,239,.96);padding:16px 22px;border-radius:14px;font-weight:600;box-shadow:0 10px 40px rgba(60,40,20,.16)}
.esd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@container (max-width:760px){.esd-cols{grid-template-columns:1fr}.esd-sim{left:50%;top:auto;bottom:64px;transform:translateX(-50%);width:94cqw;max-height:42cqh}.esd-bar .esd-scrub{display:none}}
`;

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  kids.flat().forEach((c) => c && n.append(c));
  return n;
};

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function injectStyles() {
  if (document.getElementById('esd-style')) return;
  document.head.append(el('style', { id: 'esd-style', text: CSS }));
}

export function showErrors(root, errors) {
  injectStyles();
  root.replaceChildren(
    el('div', { class: 'esd' },
      el('div', { class: 'esd-panel esd-errors', role: 'alert' },
        el('h2', { text: 'This screenplay needs fixing' }),
        el('ul', {}, errors.map((e) => el('li', { text: e }))))),
  );
}

/**
 * @param {HTMLElement} wrap
 * @param {any} sp
 * @param {ReturnType<import('./model.js').createModel>} model
 * @param {Record<string, any>} h handlers
 */
export function createUI(wrap, sp, model, h) {
  injectStyles();
  const inputsById = Object.fromEntries(sp.model.inputs.map((i) => [i.id, i]));
  const hasClock = (sp.model.stores || []).length > 0;
  const ask = sp.ask || [];

  // ---- player bar
  const playBtn = el('button', { class: 'primary', 'aria-label': 'Play', text: '▶ Play', onclick: h.togglePlay });
  const scrub = el('input', { class: 'esd-scrub', type: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'Film position' });
  scrub.addEventListener('input', () => h.seekFraction(scrub.value / 1000));
  const time = el('span', { class: 'esd-time', text: '0:00' });
  const skipBtn = el('button', { text: 'Try the model', onclick: h.skipToModel });
  const soundBtn = el('button', { 'aria-label': 'Sound', text: '♪ On', onclick: h.toggleSound });
  const recBtn = el('button', { text: '● Record MP4', onclick: h.record });
  const bar = el('div', { class: 'esd-bar' }, playBtn, scrub, time, skipBtn, soundBtn, recBtn);

  // ---- "Make it yours": the page asks the viewer about their situation
  const answers = {};
  const askRows = ask.map((q, n) => {
    if (q.input) {
      const inp = inputsById[q.input];
      const field = el('input', { type: 'number', min: String(inp.min), max: String(inp.max), step: String(inp.step ?? 'any'), placeholder: String(inp.default), id: `esd-ask-${n}`, inputmode: 'decimal' });
      field.addEventListener('input', () => {
        const v = Number(field.value);
        if (field.value !== '' && Number.isFinite(v)) answers[n] = { [q.input]: Math.min(inp.max, Math.max(inp.min, v)) };
        else delete answers[n];
      });
      return el('div', { class: 'esd-q' },
        el('label', { for: `esd-ask-${n}` }, el('b', { text: q.question })),
        q.help ? el('small', { text: q.help }) : null,
        field, el('span', { style: 'margin-left:8px;color:#6d6a66;font-size:13px', text: inp.unit || '' }));
    }
    const chips = q.choices.map((c) => {
      const b = el('button', { class: 'chip', 'aria-pressed': 'false', text: c.label });
      b.addEventListener('click', () => {
        chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        answers[n] = c.set;
      });
      return b;
    });
    return el('div', { class: 'esd-q', role: 'group', 'aria-label': q.question }, el('b', { text: q.question }), q.help ? el('small', { text: q.help }) : null, chips);
  });
  const askPanel = el('div', { class: 'esd-panel esd-ask', role: 'dialog', 'aria-label': 'Make it yours', hidden: '' },
    el('h2', { text: 'Make it yours' }),
    el('p', { text: 'Answer what you know. Anything you skip uses a typical value you can change later.' }),
    askRows,
    el('div', { class: 'esd-actions' },
      el('button', { class: 'primary', text: 'Show me my numbers →', onclick: () => h.applyAsk(Object.assign({}, ...Object.values(answers))) }),
      el('button', { text: 'Skip, use typical numbers', onclick: () => h.applyAsk({}) })));

  // ---- simulate dock
  const valueSpans = {};
  const sliders = {};
  const outSpans = {};
  const rows = sp.simulate.controls.map((id) => {
    const inp = inputsById[id];
    const step = inp.step ?? (inp.max - inp.min) / 100;
    const s = el('input', { type: 'range', min: String(inp.min), max: String(inp.max), step: String(step), value: String(inp.default), id: `esd-${id}` });
    s.addEventListener('input', () => h.setInput(id, Number(s.value)));
    sliders[id] = s;
    valueSpans[id] = el('span', { text: formatValue(inp.default, inp.unit) });
    return el('div', { class: 'esd-row' },
      el('label', { for: `esd-${id}` }, el('span', { text: inp.label + (inp.source === 'assumption' ? ' *' : '') }), valueSpans[id]),
      s);
  });
  const readouts = [...sp.model.outputs, ...(sp.model.milestones || [])];
  const outRows = readouts.map((o) => {
    outSpans[o.id] = el('span', { text: '—' });
    return el('div', { class: 'esd-row' }, el('label', {}, el('span', { text: o.label }), outSpans[o.id]));
  });
  const runBtn = hasClock ? el('button', { text: `▶ Run ${sp.world.time.span} ${sp.world.time.unit}s`, onclick: h.runClock }) : null;
  const sim = el('div', { class: 'esd-panel esd-sim', role: 'region', 'aria-label': 'Simulate', hidden: '' },
    el('h2', { text: 'Simulate' }),
    el('p', { text: (sp.simulate.prompt || 'Change the numbers and watch what moves.') + ' You can also drag things in the scene.' }),
    rows,
    el('div', { class: 'esd-out' }, outRows),
    el('div', { class: 'esd-actions' },
      runBtn,
      ask.length ? el('button', { text: 'Change my answers', onclick: h.showAsk }) : null,
      el('button', { text: 'Reset', onclick: h.reset })),
    el('div', { class: 'esd-actions' }, el('button', { class: 'primary', text: 'I’m ready to decide →', onclick: h.toDecide })),
    el('p', { style: 'margin:10px 0 0', text: '* assumption: change it to fit your situation' }));

  // ---- decide panel
  const list = (title, items) => el('div', {}, el('h3', { text: title }), el('ul', {}, items.map((t) => el('li', { text: t }))));
  const quotes = sp.source?.quotes || [];
  const assumptions = [...sp.model.inputs, ...(sp.model.constants || [])].filter((x) => x.source === 'assumption');
  const credits = (sp.world?.nodes || []).filter((c) => c.credit).map((c) => `${c.label || c.id}: ${c.credit}`);
  const srcLink = /^https?:\/\//.test(sp.source?.url || '') ? el('a', { href: sp.source.url, target: '_blank', rel: 'noopener noreferrer', text: sp.source.title || sp.source.url }) : el('span', { text: sp.source?.title || '' });
  const quoteEl = (q) => {
    const text = quoteText(q);
    const url = typeof q === 'object' && /^https?:\/\//.test(q.url || '') ? q.url : null;
    return el('blockquote', {}, text, url ? el('span', {}, ' — ', el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: q.publisher || 'source' }), q.accessed ? `, read ${q.accessed}` : '') : null);
  };
  const cmpBody = el('tbody');
  const cmpHead = el('tr');
  const cmp = sp.decide.compare ? el('table', { class: 'esd-cmp' }, el('caption', { text: 'Compare, with your numbers' }), el('thead', {}, cmpHead), cmpBody) : null;
  const decide = el('div', { class: 'esd-panel esd-decide', role: 'region', 'aria-label': 'Decide', hidden: '' },
    el('h2', { text: 'You decide.' }),
    el('p', { text: `${sp.question} This page does not recommend an answer. Here is what to weigh.` }),
    cmp,
    el('div', { class: 'esd-cols' },
      list('Trade-offs', sp.decide.tradeoffs),
      list('What this model leaves out', sp.decide.leftOut),
      list('Questions to ask', sp.decide.questionsToAsk)),
    el('div', { class: 'esd-actions' },
      el('button', { text: '← Back to the model', onclick: h.backToModel }),
      el('button', { text: '↺ Replay the film', onclick: h.replay })),
    el('details', { class: 'esd-sources' },
      el('summary', { text: 'Sources, assumptions and credits' }),
      el('p', {}, 'Source: ', srcLink, sp.source?.publisher ? ` — ${sp.source.publisher}` : ''),
      quotes.map(quoteEl),
      assumptions.length ? el('p', { text: 'Assumptions: ' + assumptions.map((a) => `${a.label} = ${formatValue(a.default ?? a.value, a.unit)}`).join('; ') }) : null,
      credits.length ? el('p', { text: 'Model credits: ' + credits.join('; ') }) : null));

  // ---- transcript for screen readers
  const transcript = el('div', { class: 'esd-sr', 'aria-live': 'polite' });
  const progress = el('div', { class: 'esd-progress', hidden: '' });
  wrap.append(bar, askPanel, sim, decide, transcript, progress);

  let dimTimer;
  wrap.addEventListener('pointermove', () => {
    bar.classList.remove('dim');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(() => bar.classList.add('dim'), 2500);
  });

  return {
    setTime(t, total) {
      scrub.value = String(Math.round((t / total) * 1000));
      time.textContent = `${clock(t)} / ${clock(total)}`;
    },
    setPlaying(on) {
      playBtn.textContent = on ? '❚❚ Pause' : '▶ Play';
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      if (on) setTimeout(() => bar.classList.add('dim'), 2500);
      else bar.classList.remove('dim');
    },
    setSound(on) {
      soundBtn.textContent = on ? '♪ On' : '♪ Off';
    },
    /** @param {Record<string, number>} values inputs  @param {Record<string, string>} shown formatted readouts */
    setValues(values, shown) {
      for (const [id, s] of Object.entries(sliders)) {
        s.value = String(values[id]);
        valueSpans[id].textContent = formatValue(values[id], inputsById[id].unit);
      }
      for (const [id, text] of Object.entries(shown)) if (outSpans[id]) outSpans[id].textContent = text;
    },
    /** @param {string[]} head  @param {{label: string, cells: string[]}[]} rows */
    setCompare(head, rows) {
      if (!cmp) return;
      cmpHead.replaceChildren(el('th', { text: '' }), ...head.map((t) => el('th', { scope: 'col', text: t })));
      cmpBody.replaceChildren(...rows.map((r) => el('tr', {}, el('th', { scope: 'row', text: r.label }), ...r.cells.map((c) => el('td', { text: c })))));
    },
    setRunning(on) {
      if (runBtn) runBtn.textContent = on ? '❚❚ Running…' : `▶ Run ${sp.world.time.span} ${sp.world.time.unit}s`;
    },
    showAsk(on) {
      askPanel.hidden = !on;
      if (on) askPanel.querySelector('input,button')?.focus();
    },
    showSim(on) {
      sim.hidden = !on;
    },
    showDecide(on) {
      decide.hidden = !on;
    },
    showBar(on) {
      bar.hidden = !on;
    },
    announce(text) {
      transcript.textContent = text;
    },
    setProgress(text) {
      progress.hidden = !text;
      progress.textContent = text || '';
    },
  };
}
