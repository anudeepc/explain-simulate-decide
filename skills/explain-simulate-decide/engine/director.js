// The director's story world. Every scene shot in the screenplay happens in one connected
// world (sets/world.js lays it out, sets/street.js builds it): the hero walks from place to
// place, and the camera follows like a Steadicam, craning over the rooftops for far moves
// (story.js plans the journeys, rig.js moves the camera).
//
// Everything is a pure function of film time, so a frame drawn twice is identical.
import * as THREE from './vendor/three/three.module.js';
import buildCharacter from './cast/character.js';
import buildHuman, { loadHumans } from './cast/human.js';
import { buildObject } from './sets/objects.js';
import { buildWorld } from './sets/street.js';
import { planStory, heroAt, shotSpans, captionAt, EXIT } from './story.js';
import { desired, follow, crane, arrive, rise, blocks } from './rig.js';
import { breathe } from './camera.js';
import { span, easeInOut, easeOut } from './timing.js';

const NURSE_TINT = '#5aa9a5';
const NURSE = { tint: NURSE_TINT, body: 'female', outfit: 'scrubs', hair: '#6b4a32', skin: '#c99a76' };

/** Get people ready to be built (a rigged human may need to load its model first). */
let humans = false;
export async function preparePeople() {
  try {
    await loadHumans();
    humans = true;
  } catch (e) {
    // without the rigged people (assets missing), the film still plays with the clay character
    console.warn('Rigged people unavailable, using the clay character:', e?.message || e);
    humans = false;
  }
}

/**
 * The one seam where people are made. Returns {object, height, hand, seat, pose(action, k, opts), setExpression}.
 * pose() opts may carry prev: {action, k, opts} and blend (0..1) to cross-fade from the last beat.
 */
export function makePerson(opts) {
  return humans ? buildHuman(opts) : buildCharacter(opts);
}

/**
 * @param {any} sp screenplay
 * @param {{makeSetScene: (o?: any) => THREE.Scene}} stage
 * @param {{accent: string}} tone the hero wears the film's accent colour
 */
export async function createScenes(sp, stage, tone) {
  const none = { has: () => false, scenes: sp.explain.map(() => null), setTimeline() {}, frame: () => null };
  if (!sp.explain.some((s) => s.shot === 'scene')) return none;
  await preparePeople();
  const hero = makePerson({ tint: tone.accent });
  const story = planStory(sp, { seatBack: -(hero.seat?.z ?? -0.32) });
  const { world, shots } = story;
  if (!Object.keys(shots).length) return none;
  const scene = stage.makeSetScene({ groundY: -0.125 });
  const built = await buildWorld(world, { accent: tone.accent });
  scene.add(built.object, hero.object);
  const nurse = Object.values(shots).some((p) => p.nurse) ? makePerson(NURSE) : null;
  if (nurse) scene.add(nurse.object);
  const objects = {};
  for (const p of Object.values(shots)) {
    for (const name of [...p.beats.map((b) => b.object), p.start.holding, p.transit.holdFrom, ...Object.keys(p.carried)]) {
      if (name && !objects[name]) {
        objects[name] = buildObject(name);
        scene.add(objects[name]);
      }
    }
  }
  // the doors each shot's journey goes through
  const nearPath = (p, path) => path.slice(1).some((b, i) => {
    const a = path[i];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const k = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(a[0] + dx * k - p[0], a[1] + dz * k - p[2]) < 0.6;
  });
  const throughDoors = Object.fromEntries(Object.entries(shots).map(([i, p]) => [i, new Set(p.transit.path ? built.doors.filter((d) => nearPath(d.at, p.transit.path)) : [])]));
  const key = scene.userData.key;
  const v = new THREE.Vector3();
  let tl = null;
  const durOf = (i) => tl.segments[i].end - tl.segments[i].start;

  /** Where the camera wants to be in shot i at s seconds (before the shot: the shot before, if the story runs on). */
  function wantAt(i, s) {
    const plan = shots[i];
    if (s < 0 && shots[i - 1] && plan.transit.kind !== 'arrive') return wantAt(i - 1, durOf(i - 1) + s);
    const d = durOf(i);
    s = Math.min(Math.max(s, 0), d);
    // while the camera cranes, the follow rig is already waiting at the new place
    const { T } = shotSpans(plan, d);
    if ((plan.transit.kind === 'crane' || plan.transit.kind === 'arrive') && s < T) s = T;
    return desired(heroAt(plan, s, d), plan, world);
  }

  function cameraAt(i, s, reducedMotion) {
    const plan = shots[i];
    const d = durOf(i);
    const { T } = shotSpans(plan, d);
    const want = (x) => wantAt(i, x);
    let pose;
    if (reducedMotion) pose = wantAt(i, s);
    // the crane leaves the follow camera still moving as it was and lands on it already moving,
    // so neither end of the move has a jolt
    else if (plan.transit.kind === 'crane' && s < T) pose = crane(s / T, follow((x) => wantAt(i - 1, x), durOf(i - 1) + s), follow(want, s));
    else if (plan.transit.kind === 'arrive' && s < T) pose = arrive(s / T, follow(want, s), world.places[plan.place].establish);
    else pose = follow(want, s);
    if (plan.exit && !reducedMotion) pose = rise(pose, span(s, d - EXIT, d));
    return pose;
  }

  /** How much each occluder is in the way, averaged over a moment either side so walls fade rather than pop. */
  function occlusion(i, s, reducedMotion) {
    const d = durOf(i);
    const out = new Float32Array(built.occluders.length);
    const times = [s - 0.7, s - 0.35, s, s + 0.35, s + 0.7].map((x) => Math.min(Math.max(x, 0), d));
    for (const x of times) {
      const cam = cameraAt(i, x, reducedMotion).position;
      const h = heroAt(shots[i], x, d);
      const y = h.seated ? 0.8 : 1.1;
      const subjects = [[h.pos[0], y, h.pos[1]], [h.pos[0], 0.3, h.pos[1]], [h.pos[0], h.seated ? 1.2 : 1.62, h.pos[1]]];
      if (shots[i].nurse) subjects.push([shots[i].nurse.position[0], 1.0, shots[i].nurse.position[2]]);
      built.occluders.forEach((o, k) => {
        // high over the street the houses stay solid, so the neighbourhood reads; only walls cut away
        if (cam[1] > 8 && o.kind !== 'wall') return;
        const min = o.box.min.toArray();
        const max = o.box.max.toArray();
        // in the way: the camera is inside it, or it stands between the camera and someone outside it
        const inside = (p) => blocks(p, p, min, max, 0.05);
        if (blocks(cam, cam, min, max, 0.35) || subjects.some((p) => !inside(p) && blocks(cam, p, min, max))) out[k] += 1 / times.length;
      });
    }
    return out;
  }

  function placeObjects(h) {
    for (const [name, obj] of Object.entries(objects)) {
      obj.visible = true;
      obj.scale.setScalar(1);
      if (h.holding === name) {
        if (obj.parent !== hero.hand) hero.hand.add(obj);
        obj.position.set(0, 0, 0);
        obj.rotation.set(0, 0, 0);
        obj.scale.setScalar(Math.max(0.001, h.scale?.[name] ?? 1));
        continue;
      }
      if (obj.parent !== scene) scene.add(obj);
      obj.rotation.set(0, 0, 0);
      const r = h.rest[name];
      if (h.flying?.obj === name) {
        hero.hand.getWorldPosition(v);
        const sp = h.flying.spot;
        obj.position.set(v.x + (sp[0] - v.x) * h.flying.k, v.y + (sp[1] - v.y) * h.flying.k, v.z + (sp[2] - v.z) * h.flying.k);
      } else if (r) {
        obj.position.set(...r.at);
        // paper lies flat where it rests; the kit stands upright on its cap end
        const f = obj.userData.flat;
        if (f && name !== 'kit') obj.rotation.set(...f);
      } else obj.visible = false;
    }
  }

  return {
    has: (index) => !!shots[index],
    /** Per explain shot: seconds a scene needs for its journey, and its beats (for timing.buildTimeline). */
    scenes: story.scenes,
    story,
    triangles: built.triangles,
    setTimeline(t) {
      tl = t;
    },
    /**
     * Stage shot `index` at progress `local` (0..1) and film time `t`.
     * @returns {{scene: THREE.Scene, pose: {position: number[], target: number[]}, dip: number}}
     */
    /** The subtitle at this moment of a scene shot: the beat's own line, or the shot's caption. */
    caption(index, local) {
      const plan = shots[index];
      const d = durOf(index);
      return captionAt(plan, local * d, d, sp.explain[index].caption);
    },
    frame(index, local, t, { reducedMotion = false } = {}) {
      const plan = shots[index];
      const d = durOf(index);
      const s = local * d;
      const h = heroAt(plan, s, d);

      // the hero
      hero.object.position.set(h.pos[0], 0, h.pos[1]);
      hero.object.rotation.y = h.facing;
      hero.object.updateMatrixWorld(true);
      let opts = h.opts || {};
      if (h.reach) {
        // aim the hand at the real place: the mat, the post box slot, the shelf
        const p = hero.object.worldToLocal(v.set(...h.reach));
        opts = { ...opts, target: { x: p.x, y: p.y, z: p.z } };
      }
      if (h.prev && !opts.prev) opts = { ...opts, prev: h.prev, blend: 1 };
      hero.pose(h.action, h.k, opts);
      hero.setExpression(h.feel);
      hero.object.updateMatrixWorld(true);

      // the second person answers the hero: talking while they listen, listening while they talk
      if (nurse) {
        // she stays where she was while the camera leaves (a crane or walk away from her room)
        const before = shots[index - 1];
        const { T } = shotSpans(plan, d);
        const where = plan.nurse || (before?.nurse && plan.transit.kind !== 'arrive' && s < T ? before.nurse : null);
        nurse.object.visible = !!where;
        if (where) {
          nurse.object.position.set(...where.position);
          nurse.object.rotation.y = where.facing;
          // her own clock, not the hero's beats, so her movement never restarts mid-gesture
          const k = (t / 7) % 1;
          nurse.pose(h.action === 'talk' ? 'listen' : 'talk', k, { sitting: where.sitting });
          nurse.setExpression(h.feel === 'worried' ? 'neutral' : 'smile');
        }
      }
      placeObjects(h);

      // a door opens as the hero walks through it, and closes behind them
      for (const dr of built.doors) {
        // (it swings over a moment: never already open on the first frame of the shot)
        const through = throughDoors[index].has(dr);
        const dist = Math.hypot(dr.at[0] - h.pos[0], dr.at[2] - h.pos[1]);
        dr.leaf.rotation.y = through ? dr.swing * 1.45 * easeInOut(span(dist, 2.2, 0.9)) * easeInOut(span(s, 0, 0.9)) : 0;
      }

      const pose = cameraAt(index, s, reducedMotion);

      // fade whatever stands between the camera and the people
      const occ = occlusion(index, s, reducedMotion);
      built.occluders.forEach((o, k) => {
        const f = easeInOut(occ[k]);
        const on = f > 0.002;
        for (const m of o.mats) {
          if (m.transparent !== on) {
            m.transparent = on;
            m.needsUpdate = true;
          }
          m.opacity = 1 - f;
          m.depthWrite = f < 0.5;
        }
      });

      // the sun follows the action, so shadows are sharp where we look
      if (key) {
        const r = Math.min(30, Math.max(8, 5 + pose.position[1] * 1.1));
        const texel = (2 * r) / key.shadow.mapSize.x;
        const cx = Math.round(pose.target[0] / texel) * texel;
        const cz = Math.round(pose.target[2] / texel) * texel;
        key.target.position.set(cx, 0, cz);
        key.position.set(cx - 6, 11, cz - 7.5);
        Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 60 });
        key.shadow.camera.updateProjectionMatrix();
        key.target.updateMatrixWorld();
      }

      let dip = 0;
      if (!reducedMotion) {
        if (plan.transit.kind === 'arrive') dip = 1 - easeOut(span(s, 0, 0.5));
        if (plan.exit) dip = Math.max(dip, easeInOut(span(s, d - 0.5, d)));
      }
      return { scene, pose: reducedMotion ? pose : breathe(pose, t), dip };
    },
  };
}
