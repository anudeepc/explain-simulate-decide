// Blocking for the diorama: where each node stands and how each flow travels.
// Flows define the order left → right (cause before effect). Nodes that share a
// column spread front-to-back and the row bows gently toward the audience so
// nobody hides anybody. Stores (what builds up) take the last column, where the
// story ends. Pure and deterministic.

const COL = 6.2; // distance between columns
const ROW = 4.4; // distance between nodes in one column
const BOW = 0.035; // how much the ends of the set come forward
const SKY_Y = 4.6;
const PORT_Y = 0.17; // flows run just above the ground
export const FOOT = 1.25; // radius of a node's footprint

/**
 * @param {{nodes: any[], flows: any[]}} world
 * @returns {{nodes: Record<string, {x: number, y: number, z: number, rotY: number, host?: string, sky?: boolean}>, ranks: number}}
 */
export function layoutWorld(world) {
  const nodes = world.nodes;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const hostOf = (id) => byId[id]?.on || id;
  const ground = nodes.filter((n) => !n.on && !n.sky && !n.store);
  const stores = nodes.filter((n) => !n.on && !n.sky && n.store);

  // edges between ground hosts, in screenplay order
  const out = Object.fromEntries(ground.map((n) => [n.id, []]));
  for (const f of world.flows) {
    const a = hostOf(f.from);
    const b = hostOf(f.to);
    if (a === b || !out[a] || !out[b] || out[a].includes(b)) continue;
    out[a].push(b);
  }
  // break cycles: depth-first in screenplay order, drop edges back into the stack
  const state = {};
  const dag = Object.fromEntries(ground.map((n) => [n.id, []]));
  const visit = (id) => {
    state[id] = 1;
    for (const b of out[id]) {
      if (state[b] === 1) continue;
      dag[id].push(b);
      if (!state[b]) visit(b);
    }
    state[id] = 2;
  };
  ground.forEach((n) => state[n.id] || visit(n.id));
  // rank = longest path from a root
  const rank = Object.fromEntries(ground.map((n) => [n.id, 0]));
  for (let pass = 0; pass < ground.length; pass++) {
    for (const a of Object.keys(dag)) for (const b of dag[a]) rank[b] = Math.max(rank[b], rank[a] + 1);
  }
  const maxRank = Math.max(0, ...Object.values(rank));

  const pos = {};
  for (let r = 0; r <= maxRank; r++) {
    const col = ground.filter((n) => rank[n.id] === r).sort((a, b) => (b.store ? 1 : 0) - (a.store ? 1 : 0));
    col.forEach((n, i) => {
      const x = (r - maxRank / 2) * COL;
      const z = ((col.length - 1) / 2 - i) * ROW + BOW * x * x;
      pos[n.id] = { x: round(x), y: 0, z: round(z), rotY: round(-x * 0.035) };
    });
  }
  // stores: one more column on the right, a little forward, where the story ends
  stores.forEach((s, i) => {
    const x = (maxRank + 1 - maxRank / 2) * COL;
    const z = ((stores.length - 1) / 2 - i) * ROW + BOW * x * x + 0.8;
    pos[s.id] = { x: round(x), y: 0, z: round(z), rotY: round(-x * 0.035) };
  });
  // recentre so the set is balanced around x = 0
  const xsAll = Object.values(pos).map((p) => p.x);
  const mid = (Math.min(...xsAll) + Math.max(...xsAll)) / 2;
  for (const p of Object.values(pos)) p.x = round(p.x - mid);
  for (const n of nodes) {
    if (n.on && pos[n.on]) pos[n.id] = { ...pos[n.on], host: n.on };
  }
  for (const n of nodes.filter((n) => n.sky)) {
    const out = world.flows.filter((f) => f.from === n.id).map((f) => pos[hostOf(f.to)]);
    const back = world.flows.filter((f) => f.to === n.id).map((f) => pos[hostOf(f.from)]);
    const targets = [...out, ...back].filter(Boolean);
    const x = targets.length ? targets.reduce((s, p) => s + p.x, 0) / targets.length : 0;
    const z = targets.length ? targets.reduce((s, p) => s + p.z, 0) / targets.length : 0;
    pos[n.id] = { x: round(x + 1.2), y: SKY_Y, z: round(z - 4.5), rotY: 0, sky: true };
  }
  return { nodes: pos, ranks: maxRank + 1 };
}

/**
 * Lane offsets so several flows between the same two nodes run side by side.
 * @returns {Record<string, number>} flow id → offset (world units, perpendicular)
 */
export function lanes(world) {
  const byId = Object.fromEntries(world.nodes.map((n) => [n.id, n]));
  const hostOf = (id) => byId[id]?.on || id;
  const groups = {};
  for (const f of world.flows) {
    const a = hostOf(f.from);
    const b = hostOf(f.to);
    const key = [a, b].sort().join('|');
    (groups[key] ||= []).push(f);
  }
  const out = {};
  for (const list of Object.values(groups)) {
    list.forEach((f, i) => {
      const a = hostOf(f.from);
      const b = hostOf(f.to);
      const sign = a < b ? 1 : -1; // same physical side whichever way the flow runs
      out[f.id] = (i - (list.length - 1) / 2) * 0.75 * sign;
    });
  }
  return out;
}

/**
 * Points a flow travels through, from its start port to its end port.
 * @param {{p: number[], ground: number[], sky?: boolean, top?: number[]}} a start: node ground position, and `top` when the node sits on another
 * @param {{p: number[], ground: number[], sky?: boolean, top?: number[]}} b end
 * @param {number} lane perpendicular offset
 * @returns {number[][]}
 */
export function routeFlow(a, b, lane = 0) {
  if (a.sky) return [a.p, b.top || [b.ground[0], 2.4, b.ground[2]]];
  if (b.sky) return [a.top || [a.ground[0], 2.4, a.ground[2]], b.p];
  const dx = b.ground[0] - a.ground[0];
  const dz = b.ground[2] - a.ground[2];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  // perpendicular, oriented with the unordered pair so opposite flows share lanes
  const px = -uz;
  const pz = ux;
  const out = (g, s, foot) => [g[0] + ux * foot * s + px * lane * 0.6, PORT_Y, g[2] + uz * foot * s + pz * lane * 0.6];
  const P = out(a.ground, 1, a.foot ?? FOOT);
  const Q = out(b.ground, -1, b.foot ?? FOOT);
  const M = [(P[0] + Q[0]) / 2 + px * lane, PORT_Y, (P[2] + Q[2]) / 2 + pz * lane];
  const pts = [];
  if (a.top) pts.push(a.top, [P[0], a.top[1] * 0.55, P[2]]);
  pts.push(P, M, Q);
  if (b.top) pts.push([Q[0], b.top[1] * 0.55, Q[2]], b.top);
  return pts.map((p) => p.map(round));
}

const round = (v) => Math.round(v * 1000) / 1000;

/** Extent of the set on the ground. */
export function bounds(pos) {
  const pts = Object.values(pos).filter((p) => !p.sky);
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}
