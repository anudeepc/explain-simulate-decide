// The story world: every place a film's scenes visit, laid out along one street, in the
// order the film first goes there. Pure data and maths (no geometry is built here), so the
// timeline, the validator's tests and the director all agree on where everything is.
//
// World axes: x runs along the street, z points south (toward the road), y is up.
//   z < 0           the north row: the hero's house, clinics, labs (rooms open to the north)
//   0 … 2.5         front gardens and forecourts       2.5 … 5.6   north pavement
//   5.6 … 12.6      the road                           12.6 … 15.6 south pavement
//   15.6 … 17.6     south forecourts                   z > 17.6    the south row: model and facade buildings, fronts facing north
// Every camera in the story world looks from the north, so rooms (cut away on that side)
// and the fronts of the south row both face it, and no move ever needs to swing round.
import { LAYOUT as doorway } from './doorway.js';
import { LAYOUT as kitchen } from './kitchen.js';
import { LAYOUT as postbox } from './postbox.js';
import { LAYOUT as hospital } from './hospital.js';
import { LAYOUT as livingRoom } from './livingRoom.js';
import { LAYOUT as lab } from './lab.js';
import { HOUSE_ROOMS, placesOf } from './names.js';

export const LAYOUTS = { doorway, kitchen, postbox, hospital, livingRoom, lab };
export const STREET = { facadeN: 0, gardenN: 2.5, kerbN: 5.6, kerbS: 12.6, gardenS: 15.6, facadeS: 17.6 };
export const WALL_T = 0.12;
export const WALL_H = 2.7;
const HOUSE_ORDER = ['kitchen', 'doorway', 'livingRoom']; // west to east
const ROOM_DOOR = { w: 0.95, z: -2.6 }; // doorways between rooms, near the open side
const WING = 3; // solid wings either side of a clinic or lab room
const LOBBY = 2.4;
const NEIGHBOUR = 6.4; // a neighbour's house between two places
const GAP = 1.6;
const SOUTH_DEPTH = 8;
const APPROACH = 0.55; // walk straight through a doorway for this far either side

const r3 = (v) => Math.round(v * 1000) / 1000;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Set space → world: rotate by `rot` about y, then move to `origin` ([x, z]). */
export function toWorld(origin, rot, p) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const [x, y, z] = p.length === 3 ? p : [p[0], 0, p[1]];
  return [r3(origin[0] + x * c + z * s), r3(y), r3(origin[1] - x * s + z * c)];
}

/** A set camera ({position, target}) as a direction to look from: azimuth (from the subject toward the camera) and elevation. */
function viewOf(cam, rot) {
  const d = cam.position.map((v, i) => v - cam.target[i]);
  return { az: Math.atan2(d[0], d[2]) + rot, el: Math.atan2(d[1], Math.hypot(d[0], d[2])) };
}
const OUTSIDE_VIEW = { close: { az: Math.PI + 0.35, el: 0.12 }, medium: { az: Math.PI + 0.35, el: 0.17 }, wide: { az: Math.PI + 0.3, el: 0.3 } };
const FRONT_VIEW = { close: { az: Math.PI + 0.22, el: 0.12 }, medium: { az: Math.PI + 0.2, el: 0.2 }, wide: { az: Math.PI + 0.16, el: 0.3 } };

/**
 * Lay out the world for a screenplay.
 * @param {any} sp
 * @param {{seatBack?: number}} [o] how far in front of a seat a person stands before sitting
 */
export function planWorld(sp, { seatBack = 0.32 } = {}) {
  const defs = placesOf(sp);
  const order = [];
  for (const x of sp.explain || []) if (x.shot === 'scene' && defs[x.set] && !order.includes(x.set)) order.push(x.set);

  // places → sites: the house's rooms share one site
  const sites = [];
  const byKey = {};
  for (const id of order) {
    const d = defs[id];
    const room = d.kind === 'set' && HOUSE_ROOMS.includes(d.set);
    const key = room ? 'house' : id;
    const kind = room ? 'house' : d.kind === 'set' ? (d.set === 'postbox' ? 'street' : 'building') : d.kind;
    if (!byKey[key]) sites.push((byKey[key] = { key, kind, places: [] }));
    byKey[key].places.push(id);
  }

  const places = {};
  const zones = [];
  const portals = [];
  const walls = [];
  const views = [];
  const lots = { north: [], south: [] };
  const doors = []; // hinged doors the director opens as people pass: {place, index, at}
  const zone = (id, x0, z0, x1, z1, extra = {}) => zones.push({ id, rect: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], ...extra });
  const portal = (a, b, at, axis, w) => portals.push({ zones: [a, b], at: at.map(r3), axis, w });
  const wallSeg = (a, b, o = {}) => walls.push({ a: a.map(r3), b: b.map(r3), h: WALL_H, openings: [], by: 'world', ...o });
  const setPlace = (id, set, origin, rot, zoneId, extra = {}) => {
    const L = LAYOUTS[set];
    const marks = {};
    for (const [k, m] of Object.entries(L.marks)) marks[k] = { ...m, position: toWorld(origin, rot, m.position), facing: r3(m.facing + rot) };
    const spots = {};
    for (const [k, p] of Object.entries(L.spots)) spots[k] = toWorld(origin, rot, p);
    const cameras = {};
    for (const [k, c] of Object.entries(L.cameras)) cameras[k] = viewOf(c, rot);
    places[id] = { id, kind: 'set', set, origin: origin.map(r3), rot, zone: zoneId, marks, spots, cameras, ...extra };
    L.doors.forEach((d, index) => doors.push({ place: id, index, at: toWorld(origin, rot, [d.at[0], 0, d.at[1]]) }));
    return places[id];
  };
  const S = STREET;
  let x = 0;
  let lastGate = null;
  const room = (set, x0, id) => {
    const [w, d] = LAYOUTS[set].size;
    const cx = x0 + w / 2;
    zone(id, x0, -d, x0 + w, 0);
    const p = setPlace(id, set, [cx, -d / 2], Math.PI, id);
    // the set's own back wall is the front of the building, facing the street
    walls.push({ a: [r3(x0), 0], b: [r3(x0 + w), 0], h: WALL_H, by: 'set', place: id, openings: LAYOUTS[set].doors.map((dr) => ({ at: r3(w / 2 + dr.at[0]), w: dr.w })) });
    views.push({ rect: [x0, -d, x0 + w, 0], view: p.cameras });
    return { w, d, cx };
  };
  const boundary = (x0, x1, z, gates, h = 0.7) => wallSeg([x0, z], [x1, z], { h, kind: 'boundary', openings: gates.map((g) => ({ at: r3(g - x0), w: 1.1 })) });

  for (const site of sites) {
    if (site.kind === 'street') {
      // a pillar box on the north pavement, a few steps from the last front gate
      const bx = lastGate ? lastGate - 1.6 : x + 2;
      if (!lastGate) x += 5;
      const origin = [bx - 0.35, 4.1];
      const p = setPlace(site.places[0], 'postbox', origin, Math.PI, 'pavementN');
      views.push({ rect: [bx - 3.2, S.gardenN, bx + 3.2, S.kerbN], view: p.cameras });
      site.box = [r3(bx), r3(4.85)];
      continue;
    }
    if (lots.north.length || lots.south.length) x += GAP + NEIGHBOUR + GAP; // a neighbour's house between places
    const x0 = x;
    if (site.kind === 'house') {
      const ids = {};
      for (const set of HOUSE_ORDER) ids[set] = site.places.find((id) => defs[id].set === set) || (places[set] || defs[set] ? `house-${set}` : set);
      let cx = x0;
      const rooms = {};
      for (const set of HOUSE_ORDER) {
        rooms[set] = { ...room(set, cx, ids[set]), x0: cx };
        cx += rooms[set].w;
      }
      const x1 = cx;
      const d = 4.2;
      // side walls, and doorways between the rooms near the open side
      wallSeg([x0 + WALL_T / 2, 0], [x0 + WALL_T / 2, -d], { kind: 'side' });
      wallSeg([x1 - WALL_T / 2, 0], [x1 - WALL_T / 2, -d], { kind: 'side' });
      for (const [a, b] of [['kitchen', 'doorway'], ['doorway', 'livingRoom']]) {
        const sx = rooms[b].x0;
        wallSeg([sx, 0], [sx, -d], { kind: 'partition', openings: [{ at: -ROOM_DOOR.z, w: ROOM_DOOR.w }] });
        portal(ids[a], ids[b], [sx, ROOM_DOOR.z], 'x', ROOM_DOOR.w);
      }
      const doorX = rooms.doorway.cx;
      zone(`${site.key}:garden`, x0, S.facadeN, x1, S.gardenN);
      portal(ids.doorway, `${site.key}:garden`, [doorX, 0], 'z', 0.92);
      portal(`${site.key}:garden`, 'pavementN', [doorX, S.gardenN], 'z', 1.1);
      boundary(x0, x1, S.gardenN, [doorX]);
      Object.assign(site, { x0, x1, depth: d, rooms: Object.fromEntries(HOUSE_ORDER.map((s) => [s, { id: ids[s], x0: rooms[s].x0, w: rooms[s].w }])), door: doorX });
      lastGate = doorX;
      lots.north.push([x0, x1]);
      x = x1;
    } else if (site.kind === 'building') {
      const id = site.places[0];
      const set = defs[id].set;
      const [w, d] = LAYOUTS[set].size;
      const lobby = LAYOUTS[set].doors.length ? 0 : LOBBY; // no front door in the set: enter through a lobby at its side
      const rx0 = x0 + WING + lobby;
      const r = room(set, rx0, id);
      const rx1 = rx0 + w;
      const x1 = rx1 + WING;
      wallSeg([rx1 - WALL_T / 2, 0], [rx1 - WALL_T / 2, -d], { kind: 'side' });
      let doorX;
      if (lobby) {
        const lx0 = rx0 - lobby;
        doorX = lx0 + lobby / 2;
        zone(`${id}:lobby`, lx0, -d, rx0, 0);
        wallSeg([lx0 + WALL_T / 2, 0], [lx0 + WALL_T / 2, -d], { kind: 'side' });
        wallSeg([lx0, 0], [rx0, 0], { kind: 'front', openings: [{ at: lobby / 2, w: 1.0 }] });
        wallSeg([rx0, 0], [rx0, -d], { kind: 'partition', openings: [{ at: d * 0.62, w: 1.0 }] });
        portal(`${id}:lobby`, id, [rx0, -d * 0.62], 'x', 1.0);
        portal(`${id}:court`, `${id}:lobby`, [doorX, 0], 'z', 1.0);
        doors.push({ place: id, lobby: true, at: [r3(doorX), 0, 0] });
      } else {
        wallSeg([rx0 + WALL_T / 2, 0], [rx0 + WALL_T / 2, -d], { kind: 'side' });
        doorX = places[id].origin[0] - LAYOUTS[set].doors[0].at[0];
        portal(`${id}:court`, id, [doorX, 0], 'z', LAYOUTS[set].doors[0].w);
      }
      zone(`${id}:court`, x0, S.facadeN, x1, S.gardenN);
      portal(`${id}:court`, 'pavementN', [doorX, S.gardenN], 'z', 1.1);
      boundary(x0, x1, S.gardenN, [doorX]);
      Object.assign(site, { x0, x1, depth: d, room: [rx0, rx1], lobby: lobby ? [rx0 - lobby, rx0] : null, door: r3(doorX), set });
      lastGate = doorX;
      lots.north.push([x0, x1]);
      x = x1;
    } else {
      // model or facade: a building on the south row, its front facing north across the road
      const id = site.places[0];
      const def = defs[id];
      const w = Math.min(24, Math.max(6, Number(def.width) || (def.kind === 'model' ? 10 : 9)));
      const x1 = x0 + w;
      const doorX = (x0 + x1) / 2;
      const F = S.facadeS;
      const deskX = doorX + Math.min(2.3, w / 2 - 1.2);
      const look = 0; // facing +z: toward the building
      const marks = {
        front: { position: [r3(doorX - 0.6), 0, r3(F - 2.8)], facing: look },
        entrance: { position: [r3(doorX), 0, r3(F - 1.2)], facing: look },
        // someone who works here, by the door, turned toward a visitor at the entrance
        host: { position: [r3(doorX + 1.0), 0, r3(F - 0.55)], facing: r3(Math.atan2(-1.0, -0.65)) },
      };
      const spots = { door: [r3(doorX), 1.05, r3(F - 0.06)] };
      if (def.kind === 'facade') {
        marks.desk = { position: [r3(deskX), 0, r3(F - 1.75)], facing: look };
        marks.host = { position: [r3(deskX), 0, r3(F - 0.45)], facing: Math.PI };
        spots.desk = [r3(deskX), 1.04, r3(F - 1.12)];
        spots.sign = [r3(doorX), 3.3, r3(F - 0.1)];
      }
      // the view that introduces the place: its whole front, name and picture, from across the road
      const establish = { position: [r3(doorX - 2.5), 4.6, r3(F - 15)], target: [r3(doorX), 3.6, F] };
      places[id] = { id, kind: def.kind, origin: [r3(doorX), F], rot: 0, zone: `${id}:court`, marks, spots, cameras: FRONT_VIEW, establish, lot: [r3(x0), r3(x1)], depth: SOUTH_DEPTH };
      zone(`${id}:court`, x0, S.gardenS, x1, F);
      portal('pavementS', `${id}:court`, [doorX, S.gardenS], 'z', 1.1);
      portal('pavementN', 'road', [doorX, S.kerbN], 'z', 2.4);
      portal('road', 'pavementS', [doorX, S.kerbS], 'z', 2.4);
      wallSeg([x0, F], [x1, F], { kind: 'front', h: 6 });
      boundary(x0, x1, S.gardenS, [doorX]);
      views.push({ rect: [x0 - 1, S.kerbS, x1 + 1, F], view: FRONT_VIEW });
      Object.assign(site, { x0, x1, door: r3(doorX), crossing: r3(doorX), desk: def.kind === 'facade' ? r3(deskX) : null });
      lots.south.push([x0, x1]);
      x = x1;
    }
  }

  const extent = [-26, Math.max(x, 10) + 26];
  zone('pavementN', extent[0], S.gardenN, extent[1], S.kerbN);
  zone('road', extent[0], S.kerbN, extent[1], S.kerbS);
  zone('pavementS', extent[0], S.kerbS, extent[1], S.gardenS);

  // neighbours fill the rest of both rows, so it reads as a real street
  const fill = (taken) => {
    const out = [];
    const sorted = [...taken].sort((a, b) => a[0] - b[0]);
    let cur = extent[0];
    for (const [a, b] of [...sorted, [extent[1], extent[1]]]) {
      const room = a - cur - GAP;
      const n = Math.floor((room + GAP) / (NEIGHBOUR + GAP));
      if (n > 0) {
        const w = (room + GAP) / n - GAP;
        for (let i = 0; i < n; i++) out.push([r3(cur + GAP + i * (w + GAP)), r3(cur + GAP + i * (w + GAP) + w)]);
      }
      cur = Math.max(cur, b);
    }
    return out;
  };
  const neighbours = { north: fill(lots.north), south: fill(lots.south) };

  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const inRect = (r, p, pad = 0) => p[0] >= r[0] - pad && p[0] <= r[2] + pad && p[1] >= r[1] - pad && p[1] <= r[3] + pad;
  /** The walkable zone a point is in (rooms and forecourts before the open street). */
  const zoneAt = (p) => (zones.find((z) => inRect(z.rect, p)) || zones.find((z) => inRect(z.rect, p, 0.3)))?.id || null;
  /** Which way to look at a person standing at p: the room's own camera, or the street's. */
  const viewAt = (p) => views.find((v) => inRect(v.rect, p))?.view || OUTSIDE_VIEW;

  /**
   * A walking route from a to b ([x, z]): straight within a room or along the street,
   * and straight through each doorway on the way. Shortest by distance.
   * @returns {number[][]} points [x, z]
   */
  function route(a, b) {
    const za = zoneAt(a);
    const zb = zoneAt(b);
    if (!za || !zb || za === zb) return [a, b];
    // Dijkstra over (portal crossed, zone now in)
    const key = (i, z) => `${i}|${z}`;
    const best = { start: 0 };
    const from = {};
    const state = { start: { zone: za, pos: a } };
    const open = ['start'];
    const done = new Set();
    let goal = null;
    let goalCost = Infinity;
    while (open.length) {
      open.sort((p, q) => best[p] - best[q]);
      const k = open.shift();
      if (done.has(k)) continue;
      done.add(k);
      const { zone: z, pos } = state[k];
      if (best[k] >= goalCost) break;
      if (z === zb) {
        const c = best[k] + dist(pos, b);
        if (c < goalCost) {
          goalCost = c;
          goal = k;
        }
        continue;
      }
      portals.forEach((p, i) => {
        if (!p.zones.includes(z)) return;
        const next = p.zones[0] === z ? p.zones[1] : p.zones[0];
        const nk = key(i, next);
        const c = best[k] + dist(pos, p.at);
        if (c < (best[nk] ?? Infinity)) {
          best[nk] = c;
          from[nk] = k;
          state[nk] = { zone: next, pos: p.at, portal: i, came: z };
          open.push(nk);
        }
      });
    }
    if (!goal) return [a, b];
    const chain = [];
    for (let k = goal; k !== 'start'; k = from[k]) chain.unshift(state[k]);
    const pts = [a];
    for (const s of chain) {
      const p = portals[s.portal];
      const zr = zoneById[s.came].rect;
      const ax = p.axis === 'x' ? 0 : 1;
      const side = Math.sign((zr[ax] + zr[ax + 2]) / 2 - p.at[ax]) || 1;
      const off = (k) => (ax === 0 ? [p.at[0] + side * k, p.at[1]] : [p.at[0], p.at[1] + side * k]);
      pts.push(off(APPROACH), p.at.slice(), off(-APPROACH));
    }
    pts.push(b);
    // drop points that double back on themselves (a mark right beside a doorway)
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) if (dist(pts[i], out.at(-1)) > 0.05) out.push(pts[i]);
    return out.map((p) => p.map(r3));
  }

  /** A mark as a place to stand: a seat mark becomes the spot just in front of the seat. */
  function standAt(placeId, name) {
    const m = places[placeId]?.marks[name];
    if (!m) return null;
    if (m.pose !== 'sit' && !m.seat) return { position: m.position, facing: m.facing };
    return { position: [r3(m.position[0] + Math.sin(m.facing) * seatBack), 0, r3(m.position[2] + Math.cos(m.facing) * seatBack)], facing: m.facing, seat: true };
  }

  return { places, defs, sites, zones, portals, walls, views, neighbours, doors, extent, street: S, zoneAt, viewAt, route, standAt, order };
}

/** Length of a route. */
export const routeLength = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);
