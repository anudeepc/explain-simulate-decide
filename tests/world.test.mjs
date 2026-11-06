// The story world: places laid out along one street in the order the film goes there,
// routes that never pass through a wall, and a hero who is one person across scenes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planWorld, routeLength, LAYOUTS } from '../skills/explain-simulate-decide/engine/sets/world.js';
import { planStory, heroAt, CRANE_OVER } from '../skills/explain-simulate-decide/engine/story.js';
import { buildTimeline } from '../skills/explain-simulate-decide/engine/timing.js';
import { SETS, SET_MARKS, SET_SPOTS, PLACE_MARKS, PLACE_SPOTS, marksOf } from '../skills/explain-simulate-decide/engine/sets/names.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const bowel = () => load('../examples/bowel-screening/screenplay.json');

/** Every set in one film, plus a model and a facade across the road. */
function everything() {
  const sp = bowel();
  sp.places = [
    { id: 'office', kind: 'facade', label: 'Screening Office' },
    { id: 'townHall', kind: 'model', url: 'x.glb', credit: 'test' },
  ];
  const at = (set) => ({ shot: 'scene', set, beats: [{ do: 'idle' }], caption: 'x' });
  sp.explain = [...SETS, 'office', 'townHall'].map(at);
  return sp;
}

// does segment p-q cross segment a-b (2D, proper crossing)?
function crosses(p, q, a, b) {
  const d = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
  const d1 = d(a, b, p);
  const d2 = d(a, b, q);
  const d3 = d(p, q, a);
  const d4 = d(p, q, b);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}
/** Where along wall a-b (metres from a) the segment p-q crosses it. */
function crossAt(p, q, a, b) {
  const r = [q[0] - p[0], q[1] - p[1]];
  const s = [b[0] - a[0], b[1] - a[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  const u = ((a[0] - p[0]) * r[1] - (a[1] - p[1]) * r[0]) / -den;
  return u * Math.hypot(...s);
}

test('names list every mark and spot the set builders have', () => {
  for (const s of SETS) {
    assert.deepEqual(Object.keys(LAYOUTS[s].marks).sort(), [...SET_MARKS[s]].sort(), s);
    assert.deepEqual(Object.keys(LAYOUTS[s].spots).sort(), [...SET_SPOTS[s]].sort(), s);
  }
  const w = planWorld(everything());
  for (const kind of ['model', 'facade']) {
    const p = Object.values(w.places).find((x) => x.kind === kind);
    assert.deepEqual(Object.keys(p.marks).sort(), [...PLACE_MARKS[kind]].sort(), kind);
    assert.deepEqual(Object.keys(p.spots).sort(), [...PLACE_SPOTS[kind]].sort(), kind);
  }
});

test('places stand along the street in the order the film first goes there', () => {
  const w = planWorld(bowel());
  assert.deepEqual(w.order, ['doorway', 'kitchen', 'postbox', 'hospital', 'livingRoom']);
  const house = w.sites.find((s) => s.kind === 'house');
  const clinic = w.sites.find((s) => s.key === 'hospital');
  assert.ok(house.x1 < clinic.x0, 'the clinic is further down the street');
  // the house's rooms are joined: kitchen, hall and living room share walls
  const rooms = Object.values(house.rooms);
  for (let i = 1; i < rooms.length; i++) assert.ok(Math.abs(rooms[i].x0 - (rooms[i - 1].x0 + rooms[i - 1].w)) < 1e-6);
  // a model or facade goes across the road, its front facing the street
  const e = planWorld(everything());
  assert.ok(e.places.office.marks.front.position[2] > e.street.kerbS);
  assert.equal(JSON.stringify(planWorld(bowel())), JSON.stringify(planWorld(bowel())), 'the same screenplay gives the same world');
});

test('every mark can be reached from every other, and no route goes through a wall', () => {
  const w = planWorld(everything());
  const marks = [];
  for (const p of Object.values(w.places)) for (const m of marksOf(w.defs[p.id] || { kind: 'set', set: p.set })) marks.push([p.id, m]);
  const pts = marks.map(([p, m]) => w.standAt(p, m).position).map((p) => [p[0], p[2]]);
  const walls = w.walls;
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const r = w.route(pts[i], pts[j]);
      assert.ok(routeLength(r) < 400, 'route is sane');
      for (let k = 1; k < r.length; k++) {
        for (const wl of walls) {
          if (!crosses(r[k - 1], r[k], wl.a, wl.b)) continue;
          const at = crossAt(r[k - 1], r[k], wl.a, wl.b);
          const ok = wl.openings.some((o) => Math.abs(at - o.at) < o.w / 2 - 0.2);
          assert.ok(ok, `${marks[i].join('.')} → ${marks[j].join('.')} goes through a ${wl.kind || wl.by} wall from ${wl.a} to ${wl.b}`);
        }
      }
    }
  }
});

test('the hero is one person: each scene starts where the last ended, and far moves crane', () => {
  const sp = bowel();
  const story = planStory(sp);
  const tl = buildTimeline(sp, { scenes: story.scenes });
  const shots = story.shots;
  const kinds = Object.fromEntries(Object.values(shots).map((p) => [p.index, p.transit.kind]));
  assert.deepEqual(kinds, { 1: 'arrive', 2: 'walk', 3: 'walk', 6: 'arrive', 7: 'crane', 9: 'arrive', 10: 'crane' });
  for (const p of Object.values(shots)) {
    const prev = shots[p.index - 1];
    if (!prev) continue;
    const seg = tl.segments[p.index];
    const d = seg.end - seg.start;
    const h = heroAt(p, 0, d);
    assert.ok(Math.hypot(h.pos[0] - prev.end.pos[0], h.pos[1] - prev.end.pos[1]) < 1e-6, `shot ${p.index} starts where shot ${prev.index} ended`);
    if (p.transit.kind === 'walk') assert.ok(p.transit.len <= CRANE_OVER);
    if (p.transit.kind === 'crane') assert.ok(p.transit.len > CRANE_OVER);
    // the shot is long enough for the journey and the beats
    assert.ok(d >= p.transit.seconds + 2, `shot ${p.index} has time for its journey`);
  }
  // the kitchen walk to the post box is one continuous walk out of the front door
  assert.ok(shots[3].transit.path.some(([x, z]) => Math.abs(z) < 0.01), 'through the front door');
});

test('places without a screenplay "places" list are the built-in sets, and timing is unchanged for films with no scenes', () => {
  const solar = load('../examples/solar/screenplay.json');
  const story = planStory(solar);
  assert.equal(Object.keys(story.shots).length, 0);
  assert.deepEqual(buildTimeline(solar, { scenes: story.scenes }), buildTimeline(solar));
});
