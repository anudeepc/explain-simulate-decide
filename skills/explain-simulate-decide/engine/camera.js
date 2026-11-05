// The camera is a director's camera: one setup per shot, eased travel between
// setups, then a slow move while the idea sinks in. "follow" is the one tracking
// shot: the camera rides alongside a flow. No free orbit, ever.
import { TRAVEL, easeInOut, span, lerp } from './timing.js';

export const FOV = 32; // vertical, degrees
const DEG = Math.PI / 180;
const LABEL_ROOM = 1.2; // space above a node for its label card

/**
 * Fit a box into view from a direction.
 * @param {{cx: number, cy: number, cz: number, hw: number, hh: number, hd?: number}} box
 * @param {{az?: number, el?: number, margin?: number, aspect: number, shiftX?: number, shiftY?: number}} o
 */
export function frame(box, { az = 0, el = 15, margin = 1.15, aspect, shiftX = 0, shiftY = 0 }) {
  const t = Math.tan((FOV / 2) * DEG);
  const dist = margin * Math.max(box.hh / t, box.hw / (t * aspect)) + (box.hd || 0) * 0.6;
  const a = az * DEG;
  const e = el * DEG;
  const dir = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  const right = [Math.cos(a), 0, -Math.sin(a)];
  const visHalfW = dist * t * aspect;
  const visHalfH = dist * t;
  const target = [box.cx - right[0] * shiftX * visHalfW, box.cy - shiftY * visHalfH, box.cz - right[2] * shiftX * visHalfW];
  return { position: target.map((v, k) => v + dir[k] * dist), target };
}

/** Uniform Catmull-Rom through points (enough for a camera path). */
export function pathPoint(points, u) {
  const n = points.length - 1;
  const x = Math.min(Math.max(u, 0), 1) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n, i + 2)];
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}

/**
 * @param {Record<string, {x: number, y: number, z: number, h: number, foot: number}>} nodes placed nodes (y = base height)
 * @param {string[]} ids
 */
function boxOf(nodes, ids) {
  const pts = ids.map((id) => nodes[id]).filter(Boolean);
  const minX = Math.min(...pts.map((p) => p.x - p.foot));
  const maxX = Math.max(...pts.map((p) => p.x + p.foot));
  const minZ = Math.min(...pts.map((p) => p.z - p.foot));
  const maxZ = Math.max(...pts.map((p) => p.z + p.foot));
  const top = Math.max(...pts.map((p) => p.y + p.h + LABEL_ROOM));
  const bottom = Math.min(0, ...pts.map((p) => p.y));
  return { cx: (minX + maxX) / 2, cy: (top + bottom) / 2, cz: (minZ + maxZ) / 2, hw: (maxX - minX) / 2, hh: (top - bottom) / 2, hd: (maxZ - minZ) / 2 };
}

const still = (pose, push = 0) => ({ at: (k) => pushed(pose, push * easeInOut(k)) });
function pushed(pose, k) {
  return { position: pose.position.map((v, i) => lerp(v, pose.target[i], k)), target: pose.target };
}
function orbit(box, o, from, to, push) {
  return { at: (k) => pushed(frame(box, { ...o, az: lerp(from, to, easeInOut(k)) }), push * easeInOut(k)) };
}

/**
 * Camera setup for every timeline segment: { at(k) → pose }, k = progress after the travel.
 * @param {{nodes: Record<string, any>, flows: Record<string, {from: string, to: string, points: number[][]}>, ground: string[]}} set
 */
export function cameraSetups(tl, sp, set, { aspect = 16 / 9 } = {}) {
  const { nodes, flows, ground } = set;
  const all = boxOf(nodes, Object.keys(nodes));
  const floor = boxOf(nodes, ground);
  const narrow = aspect < 1.2;
  const wide = { az: -10, el: 24, margin: narrow ? 1.02 : 1.06, aspect, shiftY: 0.02 };
  const sim = frame(floor, { az: -6, el: 26, margin: narrow ? 1.1 : 1.62, aspect, shiftX: narrow ? 0 : 0.21, shiftY: narrow ? -0.25 : 0.08 });
  const pull = frame(floor, { az: 0, el: 34, margin: 1.5, aspect, shiftY: -0.5 });
  const center = (floor.cx);
  const sideOf = (x) => (x < center ? -1 : 1);
  const hostIds = (id, { siblings = false, sky = false } = {}) => {
    if (!flows[id]) return [nodes[id]?.host || id];
    const list = siblings ? Object.values(flows).filter((f) => f.to === flows[id].to && f.carrier === flows[id].carrier) : [flows[id]];
    const ids = list.flatMap((f) => [f.from, f.to]).map((n) => nodes[n].host || n);
    return [...new Set(ids)].filter((n) => sky || !nodes[n].sky);
  };

  return tl.segments.map((seg) => {
    if (seg.act === 'simulate') return still(sim, 0.02);
    if (seg.act === 'decide') return still(pull, 0.03);
    const shot = sp.explain[seg.index];
    if (shot.shot === 'establish') return orbit(floor, { ...wide, margin: 1.12, shiftY: -0.16 }, -22, -8, 0.05);
    if (shot.shot === 'handoff') return still(sim, 0.02);
    const compare = ['cause', 'turn', 'compare'].includes(shot.shot);
    const fromSky = flows[shot.focus] && nodes[flows[shot.focus].from].sky;
    const box = boxOf(nodes, hostIds(shot.focus, { siblings: compare, sky: fromSky }));
    const s = sideOf(box.cx);
    switch (shot.shot) {
      case 'introduce':
        return still(frame(box, { az: 26 * s, el: 16, margin: 1.9, aspect, shiftX: 0.28 * s, shiftY: 0.05 }), 0.06);
      case 'focus':
        return still(frame(box, { az: 12 * s, el: 14, margin: 1.6, aspect, shiftX: 0.2 * s, shiftY: 0.08 }), 0.07);
      case 'compare':
        return still(frame(box, { az: 0, el: 13, margin: 1.7, aspect, shiftY: 0.08 }), 0.03);
      case 'turn':
        return orbit(box, { el: 11, margin: 1.55, aspect, shiftY: 0.08 }, -26 * s, -14 * s, 0.1);
      case 'timelapse':
        return still(frame(box, { az: -14 * s, el: 12, margin: 1.75, aspect, shiftX: -0.22 * s, shiftY: 0.05 }), 0.08);
      case 'cause':
        return still(frame(box, { az: -6, el: 22, margin: 1.28, aspect, shiftY: 0.06 }), 0.05);
      case 'follow':
        // a flow from the sky is shot looking up the beam, not ridden
        if (fromSky) return still(frame(box, { az: -18, el: 6, margin: 1.15, aspect, shiftY: -0.05 }), 0.05);
        return follow(flows[shot.focus], box, aspect);
      default:
        return still(frame(all, wide), 0.03);
    }
  });
}

/** Ride alongside a flow: from its start to its end, looking a little ahead. */
function follow(flow, box, aspect) {
  const pts = flow.points;
  const startPose = frame(box, { az: -8, el: 20, margin: 1.35, aspect });
  const D = Math.max(11.5, Math.min(16, Math.hypot(box.hw, box.hd) * 1.6));
  const at = (k) => {
    const u = lerp(0.2, 0.8, easeInOut(k));
    const p = pathPoint(pts, u);
    const q = pathPoint(pts, Math.min(1, u + 0.16));
    let dx = q[0] - p[0];
    let dz = q[2] - p[2];
    const len = Math.hypot(dx, dz);
    // camera on the audience side of the track
    let sx = 0.35;
    let sz = 1;
    if (len > 0.05) {
      dx /= len;
      dz /= len;
      sx = -dz;
      sz = dx;
      if (sz < 0) {
        sx = -sx;
        sz = -sz;
      }
      sx = sx * 0.95 - dx * 0.15;
      sz = sz * 0.95 - dz * 0.15;
    }
    const target = [lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5) + 0.5, lerp(p[2], q[2], 0.5)];
    const position = [target[0] + sx * D, target[1] + D * 0.5, target[2] + sz * D];
    // ease in from a framing of both ends so the move has somewhere to start from
    const w = span(k, 0, 0.25);
    return {
      position: position.map((v, i) => lerp(startPose.position[i], v, easeInOut(w))),
      target: target.map((v, i) => lerp(startPose.target[i], v, easeInOut(w))),
    };
  };
  return { at };
}

/**
 * Camera pose inside segment i at local progress (0..1).
 * @returns {{position: number[], target: number[]}}
 */
export function poseAt(setups, i, local, { reducedMotion = false } = {}) {
  const to = setups[i];
  const k = span(local, TRAVEL, 1);
  if (reducedMotion) return to.at(0);
  const end = to.at(i === 0 ? local : k);
  if (i === 0) return end;
  const travel = easeInOut(span(local, 0, TRAVEL));
  if (travel >= 1) return end;
  const from = setups[i - 1].at(1);
  return {
    position: from.position.map((v, n) => lerp(v, end.position[n], travel)),
    target: from.target.map((v, n) => lerp(v, end.target[n], travel)),
  };
}

/**
 * A camera operator never holds perfectly still: a slow, small drift (a few
 * centimetres at diorama scale) so even a held shot feels filmed, not rendered.
 * Pure function of time, so frames stay exact.
 */
export function breathe(pose, t) {
  const d = Math.hypot(...pose.position.map((v, i) => v - pose.target[i]));
  const a = d * 0.0045;
  const off = [Math.sin(t * 0.31) + 0.5 * Math.sin(t * 0.73 + 1.3), 0.6 * Math.sin(t * 0.43 + 0.7), Math.sin(t * 0.27 + 2.1) + 0.4 * Math.sin(t * 0.61)];
  return { position: pose.position.map((v, i) => v + off[i] * a), target: pose.target.map((v, i) => v + off[i] * a * 0.35) };
}
