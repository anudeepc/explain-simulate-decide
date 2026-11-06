// The places, marks and hand-held objects the engine can stage. No three.js here, so the
// validator and the page chrome can use it too. tests/set-check.mjs checks these lists
// against the set builders.

/** Built-in film sets. */
export const SETS = ['doorway', 'kitchen', 'postbox', 'hospital', 'livingRoom', 'lab'];
export const OBJECTS = ['letter', 'envelope', 'kit'];

/** Where a place comes from: a built-in set, a glTF model (url + credit), or a building front that can show a picture (image + credit). */
export const PLACE_KINDS = ['set', 'model', 'facade'];

/** These sets are rooms of one house, joined by doorways, with a front door onto the street. */
export const HOUSE_ROOMS = ['doorway', 'kitchen', 'livingRoom'];

/** Marks (where the hero stands) and spots (where things go) in each built-in set. */
export const SET_MARKS = {
  doorway: ['mat', 'enter'],
  kitchen: ['counter', 'chair'],
  postbox: ['box', 'approach'],
  hospital: ['patientChair', 'nurse', 'door', 'couch'],
  livingRoom: ['shelf', 'sofa'],
  lab: ['bench'],
};
export const SET_SPOTS = {
  doorway: ['mat', 'letterbox', 'console'],
  kitchen: ['counter', 'sink', 'sill', 'table'],
  postbox: ['slot', 'lamp'],
  hospital: ['desk', 'sideTable', 'screen'],
  livingRoom: ['shelf', 'coffeeTable'],
  lab: ['analyser', 'tray', 'rack', 'bench'],
};

/** Every model and facade place has the same marks and spots: in front of the building, at its entrance, a host by the door (where a second person stands), and for a facade a reception desk outside it. */
export const PLACE_MARKS = {
  model: ['front', 'entrance', 'host'],
  facade: ['front', 'entrance', 'desk', 'host'],
};
export const PLACE_SPOTS = {
  model: ['door'],
  facade: ['door', 'desk', 'sign'],
};

/** The marks and spots a place offers, from its definition ({kind, set}). */
export const marksOf = (place) => (place?.kind === 'set' ? SET_MARKS[place.set] : PLACE_MARKS[place?.kind]) || [];
export const spotsOf = (place) => (place?.kind === 'set' ? SET_SPOTS[place.set] : PLACE_SPOTS[place?.kind]) || [];

/** Places by id: the screenplay's own places, plus a built-in set for each scene `set` that names one. */
export function placesOf(sp) {
  const out = {};
  for (const p of Array.isArray(sp?.places) ? sp.places : []) if (p && typeof p.id === 'string') out[p.id] = { ...p };
  for (const x of Array.isArray(sp?.explain) ? sp.explain : []) if (x?.shot === 'scene' && !out[x.set] && SETS.includes(x.set)) out[x.set] = { id: x.set, kind: 'set', set: x.set };
  return out;
}
