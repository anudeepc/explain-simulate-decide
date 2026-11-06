// The look of a film: a white studio, and one accent colour chosen for the topic.
// The props bring the colour; the set stays out of the way. No three.js here, so the
// validator and the page chrome can use it too.

/** The white studio every film is shot in. */
export const STUDIO_LOOK = {
  skyTop: '#ffffff',
  horizon: '#f2f3f5',
  floor: '#f4f4f3',
  side: '#e4e2de',
  band: '#d3d0ca',
};

/**
 * A tone per kind of topic: an accent for highlights and controls, and a faint tint
 * for the diorama's ground. Chosen to read well on white and to suit the subject.
 */
export const TONES = {
  neutral: { accent: '#3b5b92', ground: '#eef0f3' },
  health: { accent: '#0e7c7b', ground: '#e8f3f1' },
  money: { accent: '#1f7a4d', ground: '#ebf3ec' },
  energy: { accent: '#c77700', ground: '#f1f2ee' },
  water: { accent: '#1f6fb2', ground: '#e8f1f8' },
  climate: { accent: '#2f855a', ground: '#e9f3e8' },
  civic: { accent: '#4c51bf', ground: '#eeeef8' },
  food: { accent: '#b4541a', ground: '#f3f1ee' },
  home: { accent: '#8a5a3c', ground: '#f1f0ee' },
};

export const toneOf = (sp) => TONES[sp?.tone] || TONES.neutral;
