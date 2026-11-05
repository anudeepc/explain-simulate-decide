// A quiet generated music bed: soft pad chords that change on each cut, with a
// gentle swell. Works on any BaseAudioContext, so the same score plays live and
// renders offline into the MP4.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const CHORDS = [
  [48, 55, 64, 67, 71], // Cmaj7(9)
  [45, 52, 60, 64, 67], // Am7
  [41, 48, 57, 60, 64], // Fmaj7
  [43, 50, 59, 62, 69], // G6/9
];
const TURN = [50, 57, 60, 65, 69]; // Dm9 — the turning point
const HOME = [48, 55, 60, 64, 67]; // C — Decide resolves home

/**
 * @param {BaseAudioContext} ctx
 * @param {{segments: any[], total: number}} tl
 * @param {AudioNode} dest
 * @param {{offset?: number, start?: number, volume?: number}} [o]
 * @returns {{stop: () => void}}
 */
export function scheduleScore(ctx, tl, dest, { offset = 0, start = ctx.currentTime, volume = 0.12 } = {}) {
  const master = ctx.createGain();
  master.gain.value = volume;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.Q.value = 0.4;
  lp.connect(master);
  master.connect(dest);
  const nodes = [];
  const at = (t) => start + t - offset;

  tl.segments.forEach((seg, i) => {
    if (seg.end + 2 < offset) return;
    const chord = seg.shot === 'turn' ? TURN : seg.act === 'decide' ? HOME : CHORDS[i % CHORDS.length];
    const s = Math.max(seg.start, offset - 0.01);
    const e = seg.act === 'decide' ? seg.end : seg.end + 1.2; // overlap into next shot
    const peak = Math.min(s + 1.4, e);
    chord.forEach((n, k) => {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = k === 0 ? 'sine' : 'triangle';
        osc.frequency.value = midi(n);
        osc.detune.value = detune;
        const g = ctx.createGain();
        const level = (k === 0 ? 0.16 : 0.07) * (seg.shot === 'turn' ? 1.15 : 1);
        g.gain.setValueAtTime(0.0001, Math.max(at(s), start));
        g.gain.linearRampToValueAtTime(level, Math.max(at(peak), start + 0.01));
        g.gain.setValueAtTime(level * 0.85, Math.max(at(e - 1.2), start + 0.02));
        g.gain.linearRampToValueAtTime(0.0001, Math.max(at(e), start + 0.03));
        osc.connect(g).connect(lp);
        osc.start(Math.max(at(s), start));
        osc.stop(Math.max(at(e) + 0.05, start + 0.05));
        nodes.push(osc);
      }
    });
    // a soft bell on each cut
    if (seg.start >= offset && i > 0) {
      const bell = ctx.createOscillator();
      bell.type = 'sine';
      bell.frequency.value = midi(chord[2] + 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at(seg.start));
      g.gain.linearRampToValueAtTime(0.05, at(seg.start) + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at(seg.start) + 2.2);
      bell.connect(g).connect(master);
      bell.start(at(seg.start));
      bell.stop(at(seg.start) + 2.3);
      nodes.push(bell);
    }
  });
  return {
    stop() {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      } catch {}
      setTimeout(() => {
        nodes.forEach((n) => { try { n.stop(); } catch {} });
        master.disconnect();
      }, 400);
    },
  };
}
