// Names of the studio props (kept free of three.js so the validator runs anywhere).
// cast/index.js maps each name to its builder; a test checks the two lists match.
export const PROPS = [
  'sun', 'house', 'roof-panel', 'stand-in', 'power-bill', 'battery', 'phone', 'coin-stack', 'clock', 'gauge',
  'car', 'plug', 'thermometer', 'calendar', 'piggy-bank', 'shopping-bag', 'cloud', 'tree', 'water-drop', 'factory',
  'person-figure', 'document', 'scale', 'arrow-flow', 'bar-stack', 'jar', 'power-pole', 'bank',
  'crowd', 'tank', 'building', 'body', 'hill',
];

// What a character is, when no prop fits exactly. The renderer gives each kind a look
// (cast/resolve.js), so any article's characters can stand on the set.
export const KINDS = [
  'person', 'crowd', 'body', 'home', 'building', 'institution', 'business', 'factory', 'farm', 'nature', 'land', 'water',
  'weather', 'sun', 'vehicle', 'machine', 'device', 'screen', 'document', 'money', 'store', 'food', 'medicine', 'time',
  'cell', 'germ', 'other',
];
