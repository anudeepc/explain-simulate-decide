// The director's scenes: small sets where the hero acts. A scene shot in the screenplay
// names a set and a few beats ("walk to the mat", "pick up the letter", "read it"); this
// file stages them in their own studio and plays the beats in order. Everything is a
// pure function of the shot's progress, so a frame drawn twice is identical.
import * as THREE from './vendor/three/three.module.js';
import buildCharacter from './cast/character.js';
import { SET_BUILDERS } from './sets/index.js';
import { buildObject } from './sets/objects.js';
import { breathe } from './camera.js';
import { easeInOut, span, lerp, clamp01 } from './timing.js';

const LEAD = 0.06; // a breath before the first beat
const TAIL = 0.92; // and after the last
const STEP = 0.7; // metres per step when walking
const NURSE_TINT = '#5aa9a5';

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnTo = (from, to, k) => from + wrapAngle(to - from) * k;

/**
 * @param {any} sp screenplay
 * @param {{makeSetScene: () => THREE.Scene}} stage
 * @param {{accent: string}} tone the hero wears the film's accent colour
 */
export function createScenes(sp, stage, tone) {
  const staged = {};
  sp.explain.forEach((shot, i) => {
    if (shot.shot !== 'scene') return;
    const build = SET_BUILDERS[shot.set];
    if (!build) return;
    // each shot gets its own copy of its set, so nothing one scene does leaks into another
    const scene = stage.makeSetScene();
    const set = build();
    scene.add(set.object);
    const hero = buildCharacter({ tint: tone.accent });
    scene.add(hero.object);
    let nurse = null;
    if (shot.with === 'nurse') {
      nurse = buildCharacter({ tint: NURSE_TINT, outfit: 'scrubs', hair: '#6b4a32', skin: '#c99a76' });
      const m = set.marks.nurse || Object.values(set.marks).at(-1);
      // a seated mark is the seat itself: the nurse sits back onto it from just in front
      const back = m.pose === 'sit' || m.seat ? -(nurse.seat?.z ?? -0.32) : 0;
      nurse.object.position.set(m.position[0] + Math.sin(m.facing) * back, m.position[1], m.position[2] + Math.cos(m.facing) * back);
      nurse.object.rotation.y = m.facing;
      nurse.sitting = back > 0;
      scene.add(nurse.object);
    }
    const objects = {};
    for (const b of shot.beats || []) {
      if (b.object && !objects[b.object]) {
        objects[b.object] = buildObject(b.object);
        scene.add(objects[b.object]);
      }
    }
    staged[i] = { shot, scene, set, hero, nurse, objects };
  });

  const v = new THREE.Vector3();

  /** Replay the beats up to `local` (0..1) and pose everyone. */
  function play(rt, local) {
    const { shot, set, hero, nurse, objects, scene } = rt;
    const beats = shot.beats || [];
    const seatBack = -(hero.seat?.z ?? -0.32); // the hero sits onto a seat this far behind their feet
    const mark = (name) => {
      const m = name && set.marks[name];
      if (!m) return null;
      if (m.pose !== 'sit' && !m.seat) return m;
      // a chair mark is the seat itself: stand just in front of it
      return { position: [m.position[0] + Math.sin(m.facing) * seatBack, m.position[1], m.position[2] + Math.cos(m.facing) * seatBack], facing: m.facing };
    };
    const firstWalk = beats.find((b) => b.do === 'walk' || b.do === 'sit');
    const start = mark(shot.at) || (firstWalk ? null : mark(beats.find((b) => b.at)?.at)) || Object.values(set.marks)[0] || { position: [0, 0, 0], facing: 0 };
    const pos = new THREE.Vector3(...start.position);
    let facing = start.facing;
    let holding = null;
    let seated = !!shot.seated; // the scene may open with the hero already in a chair
    let feel = shot.feel || 'neutral';
    const rest = {}; // object → where it lies
    // where each object starts: on its spot if the hero picks it up there, otherwise in the hero's hand
    for (const b of beats) {
      if (!b.object || b.object in rest || holding === b.object) continue;
      if (b.do === 'pickUp' && set.spots[b.from]) rest[b.object] = set.spots[b.from];
      else if (!holding) holding = b.object;
    }

    const n = Math.max(1, beats.length);
    const u = span(local, LEAD, TAIL) * n;
    const cur = Math.min(n - 1, Math.floor(u));
    let action = 'idle';
    let p = local;
    let opts = {};
    let flying = null; // an object on its way from the hand to its spot
    let reach = null; // where the hand reaches in the current beat (a slot, a shelf, the mat)
    for (let i = 0; i <= cur && i < beats.length; i++) {
      const b = beats[i];
      const k = i < cur ? 1 : clamp01(u - i);
      if (b.feel) feel = b.feel;
      action = b.do;
      p = k;
      opts = { sitting: seated };
      if (b.do === 'walk') {
        const m = mark(b.to);
        if (!m) continue;
        const to = new THREE.Vector3(...m.position);
        const dist = pos.distanceTo(to);
        const heading = Math.atan2(to.x - pos.x, to.z - pos.z);
        // turn toward the goal, walk, then turn to face what is there
        if (dist > 0.05) {
          const turn = easeInOut(span(k, 0, 0.15));
          const go = easeInOut(span(k, 0.12, 0.88));
          const settle = easeInOut(span(k, 0.85, 1));
          facing = turnTo(turnTo(facing, heading, turn), m.facing, settle);
          pos.lerp(to, go);
          opts = { cycles: Math.max(1, Math.round(dist / STEP)) };
          p = span(k, 0.12, 0.88);
          if (k >= 1) pos.copy(to);
        } else facing = turnTo(facing, m.facing, easeInOut(k));
        seated = false;
      } else if (b.do === 'sit') {
        const m = mark(b.at);
        if (m) {
          pos.set(...m.position);
          facing = m.facing;
        }
        if (k >= 1) seated = true;
      } else if (b.do === 'pickUp') {
        if (i === cur && set.spots[b.from]) reach = set.spots[b.from];
        if (k >= 0.5 && b.object) {
          holding = b.object;
          delete rest[b.object];
        }
      } else if (b.do === 'give' || b.do === 'place') {
        const obj = b.object || holding;
        const spot = set.spots[b.to];
        if (i === cur && spot) reach = spot;
        if (k >= 0.5 && obj && holding === obj) {
          holding = null;
          if (spot) {
            rest[obj] = spot;
            if (i === cur && k < 0.8) flying = { obj, k: span(k, 0.5, 0.8), spot };
          }
        }
      }
    }
    if (local >= TAIL && beats.length) p = 1;
    if (seated && !['sit', 'talk', 'listen', 'read'].includes(action)) {
      action = 'sit'; // a seated hero who reacts stays in the chair
      p = 1;
    }
    if (seated && action !== 'sit') opts = { ...opts, sitting: true };
    hero.object.position.copy(pos);
    hero.object.rotation.y = facing;
    hero.object.updateMatrixWorld(true);
    if (reach && ['pickUp', 'give', 'place'].includes(action)) {
      // aim the hand at the real place: the mat, the post box slot, the shelf
      const t = hero.object.worldToLocal(v.set(...reach));
      opts = { ...opts, target: { x: t.x, y: t.y, z: t.z } };
    }
    hero.pose(action, p, opts);
    hero.setExpression(feel);
    hero.object.updateMatrixWorld(true);
    if (nurse) {
      // the nurse answers the hero: talking while the hero listens, listening while the hero talks
      nurse.pose(action === 'talk' ? 'listen' : 'talk', p, { sitting: nurse.sitting });
      nurse.setExpression(feel === 'worried' ? 'neutral' : 'smile');
    }
    for (const [name, obj] of Object.entries(objects)) {
      obj.visible = true;
      if (holding === name) {
        if (obj.parent !== hero.hand) hero.hand.add(obj);
        obj.position.set(0, 0, 0);
        obj.rotation.set(0, 0, 0);
      } else {
        if (obj.parent !== scene) scene.add(obj);
        obj.rotation.set(0, 0, 0);
        if (flying?.obj === name) {
          hero.hand.getWorldPosition(v);
          obj.position.set(lerp(v.x, flying.spot[0], flying.k), lerp(v.y, flying.spot[1], flying.k), lerp(v.z, flying.spot[2], flying.k));
        } else if (rest[name]) {
          obj.position.set(...rest[name]);
          // paper lies flat where it rests; in the hand it faces the camera
          const f = obj.userData.flat;
          if (f && name !== 'kit') obj.rotation.set(...f); // the kit stands upright on its cap end
        }
        else obj.visible = false;
      }
    }
  }

  return {
    /** Is this explain shot a staged scene? */
    has: (index) => !!staged[index],
    /**
     * Stage shot `index` at progress `local` (0..1) and film time `t`.
     * @returns {{scene: THREE.Scene, pose: {position: number[], target: number[]}}}
     */
    frame(index, local, t, { reducedMotion = false } = {}) {
      const rt = staged[index];
      play(rt, local);
      const cam = rt.set.cameras[rt.shot.camera || 'medium'] || rt.set.cameras.medium;
      // a slow push in while the scene plays, as a camera operator would
      const k = reducedMotion ? 0 : easeInOut(local) * 0.06;
      const pose = { position: cam.position.map((x, i) => lerp(x, cam.target[i], k)), target: cam.target };
      return { scene: rt.scene, pose: reducedMotion ? pose : breathe(pose, t) };
    },
  };
}
