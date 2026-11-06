// Everything drawn on top of the 3D stage: captions, act chips, actor labels,
// live readouts, and the painted Simulate/Decide cards used in the recorded film.
// Drawn on a 2D canvas so the exact same pixels appear live and in the MP4.
// All text comes from the screenplay and is drawn as text, never parsed as HTML.
import { formatValue } from './model.js';

export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif';
export const INK = '#26262b';
export const MUTED = '#6d6a66';
export const PAPER = 'rgba(251, 247, 239, 0.94)';
export const ACCENT = '#c0623f';
export const GOLD = '#e2a43b';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function card(ctx, x, y, w, h, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(60, 40, 20, 0.16)';
  ctx.shadowBlur = r * 1.6;
  ctx.shadowOffsetY = r * 0.35;
  ctx.fillStyle = PAPER;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

/** Word-wrap text to a max width; returns lines. */
export function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCaption(ctx, W, H, text, alpha) {
  if (!text || alpha <= 0.01) return;
  const fs = Math.round(H * 0.036);
  ctx.font = `600 ${fs}px ${FONT}`;
  const lines = wrap(ctx, text, W * 0.62);
  const lw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const padX = fs * 1.1;
  const padY = fs * 0.7;
  const lh = fs * 1.3;
  const w = lw + padX * 2;
  const h = lines.length * lh + padY * 2 - (lh - fs);
  const x = (W - w) / 2;
  const y = H * 0.86 - h - (1 - alpha) * fs * 0.5;
  card(ctx, x, y, w, h, fs * 0.7, alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + padY + i * lh));
  ctx.restore();
}

/** The source line under the act chips. */
const hasAssumptions = (sp) => [...(sp.model?.inputs || []), ...(sp.model?.constants || [])].some((x) => x.source === 'assumption');
export const sourceLine = (sp) => `Source: ${sp.source?.publisher || sp.source?.title || ''}${hasAssumptions(sp) ? '   ·   * = assumption, change it to fit your situation' : ''}`;
/** The acts this film has: a process story has nothing to run, so no Simulate. */
export const actsOf = (sp) => (sp.shape === 'process' ? ['Explain', 'Decide'] : ['Explain', 'Simulate', 'Decide']);

export function drawActs(ctx, W, H, act, question, source = '', acts = ['Explain', 'Simulate', 'Decide']) {
  const fs = Math.round(H * 0.018);
  ctx.save();
  let x = W * 0.03;
  const y = H * 0.045;
  // a soft plate behind the header keeps it readable over bright props (the sun)
  ctx.font = `600 ${fs}px ${FONT}`;
  let chips = 0;
  for (const [i, name] of acts.entries()) chips += ctx.measureText(`${i + 1}  ${name}`).width + fs * 2.1;
  ctx.font = `500 ${fs * 1.05}px ${FONT}`;
  const top = chips + (question ? fs * 0.8 + ctx.measureText(question).width : 0);
  ctx.font = `500 ${Math.round(H * 0.0135)}px ${FONT}`;
  const plateW = Math.min(W * 0.94 - x, Math.max(top, ctx.measureText(source).width) + fs * 1.6);
  card(ctx, x - fs * 0.6, y - fs * 0.6, plateW, fs * (source ? 4.6 : 3.2), fs * 0.9, 0.72);
  ctx.font = `600 ${fs}px ${FONT}`;
  acts.forEach((name, i) => {
    const on = name.toLowerCase() === act;
    const label = `${i + 1}  ${name}`;
    const w = ctx.measureText(label).width + fs * 1.6;
    ctx.globalAlpha = on ? 1 : 0.55;
    ctx.fillStyle = on ? INK : 'rgba(255,255,255,0.6)';
    roundRect(ctx, x, y, w, fs * 2, fs);
    ctx.fill();
    ctx.fillStyle = on ? '#fff' : INK;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + fs * 0.8, y + fs);
    x += w + fs * 0.5;
  });
  if (question) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = INK;
    ctx.font = `500 ${fs * 1.05}px ${FONT}`;
    ctx.fillText(question, x + fs * 0.8, y + fs);
  }
  ctx.restore();
}

/** Small label card above an actor. */
export function drawLabel(ctx, H, x, y, title, value, alpha, assumption, parts = null) {
  if (alpha <= 0.01) return;
  const fs = Math.round(H * 0.017);
  ctx.save();
  ctx.font = `600 ${fs * 1.25}px ${FONT}`;
  const vw = ctx.measureText(value || '').width;
  // a crowd's outcomes: one line each, with a dot in that outcome's colour
  ctx.font = `600 ${fs * 1.05}px ${FONT}`;
  const pw = parts ? Math.max(...parts.map((p) => ctx.measureText(p.text).width + fs * 1.3)) : 0;
  ctx.font = `500 ${fs}px ${FONT}`;
  const tw = ctx.measureText(title + (assumption ? ' *' : '')).width;
  const w = Math.max(vw, tw, pw) + fs * 1.6;
  const h = parts ? fs * (1.9 + parts.length * 1.45) : value ? fs * 3.4 : fs * 2;
  const bx = x - w / 2;
  const by = y - h - fs * 0.6;
  card(ctx, bx, by, w, h, fs * 0.6, alpha);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = MUTED;
  ctx.fillText(title + (assumption ? ' *' : ''), x, by + fs * 0.5);
  if (parts) {
    ctx.font = `600 ${fs * 1.05}px ${FONT}`;
    ctx.textAlign = 'left';
    parts.forEach((p, i) => {
      const ly = by + fs * (1.75 + i * 1.45);
      const lx = x - pw / 2;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(lx + fs * 0.4, ly + fs * 0.55, fs * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(p.text, lx + fs * 1.1, ly);
    });
  } else if (value) {
    ctx.font = `700 ${fs * 1.25}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(value, x, by + fs * 1.7);
  }
  ctx.restore();
}

/** Outcome readout in the top-right corner. */
export function drawReadout(ctx, W, H, items, alpha) {
  if (alpha <= 0.01 || !items.length) return;
  const fs = Math.round(H * 0.018);
  const w = W * 0.2;
  const rowH = fs * 3.3;
  const h = items.length * rowH + fs * 1.2;
  const x = W - w - W * 0.03;
  const y = H * 0.045;
  card(ctx, x, y, w, h, fs * 0.8, alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  items.forEach((it, i) => {
    const ry = y + fs * 0.8 + i * rowH;
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${fs}px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(it.label, x + fs, ry);
    ctx.fillStyle = INK;
    ctx.font = `700 ${fs * 1.6}px ${FONT}`;
    ctx.fillText(it.value, x + fs, ry + fs * 1.25);
  });
  ctx.restore();
}

/** Painted slider panel for the recorded Simulate act. */
/** Text shortened with an ellipsis to fit a width (the suffix, such as " *", always stays). */
function fit(ctx, text, width, suffix = '') {
  if (ctx.measureText(text + suffix).width <= width) return text + suffix;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…' + suffix).width > width) t = t.slice(0, -1);
  return t.trimEnd() + '…' + suffix;
}

export function drawSimPanel(ctx, W, H, controls, alpha, activeId) {
  if (alpha <= 0.01) return;
  const fs = Math.round(H * 0.017);
  const w = W * 0.24;
  const rowH = fs * 4;
  const h = controls.length * rowH + fs * 1.6;
  const x = W * 0.03;
  const y = H * 0.5 - h / 2;
  card(ctx, x, y, w, h, fs * 0.8, alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  controls.forEach((c, i) => {
    const ry = y + fs + i * rowH;
    ctx.fillStyle = c.id === activeId ? INK : MUTED;
    ctx.font = `${c.id === activeId ? 700 : 500} ${fs}px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    // the value keeps its room; a long label is shortened to fit beside it
    const valueW = ctx.measureText(c.value).width;
    ctx.fillText(fit(ctx, c.label, w - fs * 3 - valueW, c.assumption ? ' *' : ''), x + fs, ry);
    ctx.textAlign = 'right';
    ctx.fillText(c.value, x + w - fs, ry);
    const tx = x + fs;
    const tw = w - fs * 2;
    const ty = ry + fs * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    roundRect(ctx, tx, ty, tw, fs * 0.4, fs * 0.2);
    ctx.fill();
    ctx.fillStyle = c.id === activeId ? ACCENT : '#9b948a';
    roundRect(ctx, tx, ty, tw * c.v, fs * 0.4, fs * 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx + tw * c.v, ty + fs * 0.2, fs * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = fs * 0.15;
    ctx.strokeStyle = c.id === activeId ? ACCENT : '#9b948a';
    ctx.stroke();
  });
  ctx.restore();
}

/** The world clock, top centre: "Year 7 of 25". */
export function drawClock(ctx, W, H, text, alpha) {
  if (!text || alpha <= 0.01) return;
  const fs = Math.round(H * 0.026);
  ctx.save();
  ctx.font = `700 ${fs}px ${FONT}`;
  const w = ctx.measureText(text).width + fs * 1.6;
  const h = fs * 1.9;
  const x = (W - w) / 2;
  const y = H * 0.13;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(38,38,43,0.88)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + h / 2 + 1);
  ctx.restore();
}

/** Painted "Make it yours" card: the questions the page asks, with the answers used. */
export function drawAskCard(ctx, W, H, rows, alpha) {
  if (alpha <= 0.01 || !rows.length) return;
  const fs = Math.round(H * 0.018);
  const w = W * 0.42;
  const rowH = fs * 3.3;
  const h = fs * 4.4 + rows.length * rowH;
  const x = (W - w) / 2;
  const y = H * 0.46 - h / 2 - (1 - alpha) * fs;
  card(ctx, x, y, w, h, fs, alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `700 ${fs * 1.4}px ${FONT}`;
  ctx.fillText('Make it yours', x + fs * 1.4, y + fs * 1.2);
  rows.forEach((r, i) => {
    const ry = y + fs * 3.6 + i * rowH;
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${fs}px ${FONT}`;
    ctx.fillText(r.question, x + fs * 1.4, ry);
    ctx.font = `700 ${fs * 1.05}px ${FONT}`;
    const tw = ctx.measureText(r.answer).width + fs * 1.4;
    ctx.fillStyle = 'rgba(192,98,63,0.12)';
    roundRect(ctx, x + fs * 1.4, ry + fs * 1.3, tw, fs * 1.6, fs * 0.8);
    ctx.fill();
    ctx.fillStyle = ACCENT;
    ctx.fillText(r.answer, x + fs * 2.1, ry + fs * 1.55);
  });
  ctx.restore();
}

/** Painted Decide card for the recorded film. */
export function drawDecideCard(ctx, W, H, sp, alpha, compare = null) {
  if (alpha <= 0.01) return;
  const fs = Math.round(H * 0.017);
  const w = W * 0.8;
  const x = (W - w) / 2;
  const y = H * 0.12 - (1 - alpha) * fs;
  const colW = (w - fs * 4) / 3;
  const cols = [
    ['Trade-offs', sp.decide.tradeoffs],
    ['What this model leaves out', sp.decide.leftOut],
    ['Questions to ask', sp.decide.questionsToAsk],
  ];
  ctx.save();
  ctx.font = `500 ${fs}px ${FONT}`;
  const wrapped = cols.map(([, items]) => items.map((t) => wrap(ctx, t, colW - fs * 1.2)));
  const bodyH = Math.max(...wrapped.map((items) => items.reduce((s, ls) => s + ls.length * fs * 1.35 + fs * 0.7, 0)));
  const tableH = compare ? fs * 2.2 + compare.rows.length * fs * 1.9 + fs * 0.8 : 0;
  const h = fs * 6.4 + tableH + bodyH + fs * 2.2;
  card(ctx, x, y, w, h, fs, alpha);
  ctx.globalAlpha = alpha;
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `700 ${fs * 1.6}px ${FONT}`;
  ctx.fillText('You decide.', x + fs * 1.5, y + fs * 1.3);
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${fs}px ${FONT}`;
  ctx.fillText(sp.question + '  This page does not recommend an answer.', x + fs * 1.5, y + fs * 3.4);
  if (compare) {
    // options side by side, under the same answers
    const tx = x + fs * 1.5;
    const tw = w - fs * 3;
    const colX = (k) => tx + tw * 0.34 + (k * tw * 0.66) / compare.head.length;
    let ty = y + fs * 5.4;
    ctx.font = `700 ${fs * 0.85}px ${FONT}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText('COMPARE, WITH YOUR NUMBERS', tx, ty);
    compare.head.forEach((hd, k) => ctx.fillText(hd.toUpperCase(), colX(k), ty));
    ty += fs * 1.6;
    compare.rows.forEach((r, i) => {
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.035)';
      roundRect(ctx, tx - fs * 0.5, ty - fs * 0.35, tw + fs, fs * 1.8, fs * 0.4);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = `600 ${fs}px ${FONT}`;
      ctx.fillText(r.label, tx, ty);
      ctx.font = `700 ${fs}px ${FONT}`;
      r.cells.forEach((c, k) => ctx.fillText(c, colX(k), ty));
      ty += fs * 1.9;
    });
  }
  cols.forEach(([title], c) => {
    const cx = x + fs * 1.5 + c * (colW + fs * 0.5);
    let cy = y + fs * 5.6 + tableH;
    ctx.fillStyle = ACCENT;
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillText(title.toUpperCase(), cx, cy);
    cy += fs * 1.8;
    ctx.font = `500 ${fs}px ${FONT}`;
    ctx.fillStyle = INK;
    for (const lines of wrapped[c]) {
      ctx.fillStyle = GOLD;
      ctx.fillText('•', cx, cy);
      ctx.fillStyle = INK;
      lines.forEach((l, k) => ctx.fillText(l, cx + fs * 1.1, cy + k * fs * 1.35));
      cy += lines.length * fs * 1.35 + fs * 0.7;
    }
  });
  ctx.restore();
}

/** Source line, bottom left. */
export function drawSource(ctx, W, H, sp, alpha) {
  if (alpha <= 0.01) return;
  const fs = Math.round(H * 0.0135);
  ctx.save();
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = INK;
  ctx.font = `500 ${fs}px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(sourceLine(sp), W * 0.03, H * 0.045 + H * 0.018 * 2.7);
  ctx.restore();
}

export const fmt = formatValue;
