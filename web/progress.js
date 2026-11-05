// A progress panel: one bar for the whole job, a line saying what is happening now,
// the list of steps with how long each took, and plain warnings when nothing arrives.
// Built with textContent only.

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * @param {HTMLElement} root
 * @param {string} name what the bar measures, for screen readers
 */
export function createProgress(root, name) {
  root.replaceChildren();
  const head = el('div', 'pg-head');
  const status = el('p', 'pg-status');
  status.setAttribute('aria-live', 'polite');
  const time = el('span', 'pg-time');
  head.append(status, time);
  const track = el('div', 'pg-track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', name);
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  const fill = el('div', 'pg-fill');
  track.append(fill);
  const note = el('p', 'pg-note');
  const warn = el('p', 'pg-warn');
  warn.setAttribute('role', 'status');
  const list = el('ol', 'pg-steps');
  const errors = el('ul', 'pg-errors');
  root.append(head, track, note, warn, list, errors);
  root.hidden = false;

  /** @type {{id: string, weight: number, li: HTMLLIElement, detail: HTMLElement, state: string, began?: number}[]} */
  let steps = [];
  let active = null;
  let within = 0;
  let shown = 0;
  let began = 0;
  let timer = 0;

  const find = (id) => steps.find((s) => s.id === id);
  const makeStep = ({ id, label, weight = 1 }) => {
    const li = el('li');
    li.dataset.state = 'waiting';
    const detail = el('span', 'pg-detail');
    li.append(el('span', 'pg-mark'), el('span', 'pg-label', label), detail);
    return { id, weight, li, detail, state: 'waiting' };
  };
  const setState = (s, state) => {
    s.state = state;
    s.li.dataset.state = state;
  };

  function paint() {
    const total = steps.reduce((a, s) => a + s.weight, 0) || 1;
    let doneW = 0;
    for (const s of steps) if (s.state === 'done' || s.state === 'warn') doneW += s.weight;
    const raw = (doneW + (active ? active.weight * within : 0)) / total;
    shown = Math.max(shown, Math.min(raw, root.dataset.state === 'done' ? 1 : 0.99)); // never runs backwards
    fill.style.width = `${(shown * 100).toFixed(1)}%`;
    track.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
    time.textContent = began ? clock(performance.now() - began) : '';
  }

  const api = {
    /** @param {{id: string, label: string, weight?: number}[]} defs */
    start(defs) {
      steps = defs.map(makeStep);
      list.replaceChildren(...steps.map((s) => s.li));
      errors.replaceChildren();
      errors.hidden = true;
      note.textContent = '';
      warn.textContent = '';
      warn.hidden = true;
      root.dataset.state = 'running';
      root.hidden = false;
      shown = 0;
      within = 0;
      active = null;
      began = performance.now();
      clearInterval(timer);
      timer = setInterval(paint, 250);
      paint();
    },
    /** Insert a step after another one (for example a repair round). */
    add(afterId, step) {
      const s = makeStep(step);
      const i = steps.findIndex((x) => x.id === afterId);
      steps.splice(i + 1, 0, s);
      (steps[i]?.li || list.lastChild)?.after(s.li);
    },
    step(id, message) {
      const s = find(id);
      active = s;
      within = 0;
      s.began = performance.now();
      setState(s, 'active');
      api.status(message || s.li.querySelector('.pg-label').textContent);
      api.note('');
      api.warn(null);
      paint();
    },
    /** How far through the active step, 0 to 1. Never moves backwards. */
    within(f) {
      within = Math.max(within, Math.min(1, f));
    },
    detail(id, text) {
      find(id).detail.textContent = text;
    },
    done(id, detail, state = 'done') {
      const s = find(id);
      setState(s, state);
      const took = s.began ? clock(performance.now() - s.began) : '';
      s.detail.textContent = [detail, took].filter(Boolean).join(', ');
      if (active === s) active = null;
      paint();
    },
    status(text) {
      if (status.textContent !== text) status.textContent = text;
    },
    note(text) {
      if (note.textContent !== text) note.textContent = text;
    },
    warn(text) {
      warn.hidden = !text;
      if (warn.textContent !== (text || '')) warn.textContent = text || '';
    },
    problems(items) {
      errors.replaceChildren(...items.map((e) => el('li', '', e)));
      errors.hidden = !items.length;
    },
    finish(message) {
      root.dataset.state = 'done';
      clearInterval(timer);
      api.status(message);
      api.warn(null);
      api.note('');
      paint();
    },
    fail(message, state = 'error') {
      if (active) {
        setState(active, 'error');
        active.detail.textContent = active.began ? clock(performance.now() - active.began) : '';
      }
      active = null;
      root.dataset.state = state;
      clearInterval(timer);
      api.status(message);
      api.warn(null);
      paint();
    },
    get elapsed() {
      return began ? performance.now() - began : 0;
    },
  };
  return api;
}
