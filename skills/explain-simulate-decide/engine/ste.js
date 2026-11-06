// A style checker for film subtitles, after ASD-STE100 Simplified Technical English
// (Issue 9). It checks the few STE rules that matter most for a short line read by a
// general audience: short sentences, active voice, plain approved words, one idea
// per sentence, and no sentence that opens with an -ing word. Each problem comes back
// as a plain-English instruction that quotes the words to change. Empty array = fine.
// No dependencies: runs in Node and in the browser.

/** STE allows 20 words in a procedural sentence and 25 in a descriptive one. Subtitles use 20. */
export const STE_MAX_WORDS = 20;

// Non-approved words and phrases, each with the plain (STE-style) word to use instead.
// "a / b" means either word works; pick the one that fits the sentence. Single words also
// match their usual forms ("require" finds "requires", "required", "requiring"), so the
// message says to use the replacement in the matching form.
export const STE_WORDS = {
  // Verbs
  accommodate: 'hold / fit',
  accompany: 'go with',
  accomplish: 'do',
  acquire: 'get',
  advise: 'tell',
  allocate: 'give',
  alleviate: 'ease / reduce',
  alter: 'change',
  ameliorate: 'improve',
  anticipate: 'expect',
  apprise: 'tell',
  ascertain: 'find out',
  assess: 'check',
  assist: 'help',
  attain: 'get',
  attempt: 'try',
  cease: 'stop',
  commence: 'start',
  communicate: 'tell',
  compensate: 'pay',
  comprise: 'have / contain',
  conclude: 'end / decide',
  constitute: 'be / make up',
  construct: 'build',
  convene: 'meet',
  deem: 'think',
  demonstrate: 'show',
  depart: 'leave',
  designate: 'name',
  deteriorate: 'get worse',
  determine: 'find / decide',
  diminish: 'decrease',
  disclose: 'tell / show',
  discontinue: 'stop',
  disseminate: 'send out',
  effectuate: 'do',
  elect: 'choose',
  eliminate: 'remove',
  elucidate: 'explain',
  employ: 'use',
  enable: 'let',
  encounter: 'meet / find',
  endeavor: 'try',
  endeavour: 'try',
  ensure: 'make sure',
  enquire: 'ask',
  inquire: 'ask',
  enumerate: 'list',
  establish: 'set up / make',
  exceed: 'be more than',
  expedite: 'speed up',
  fabricate: 'make',
  facilitate: 'help',
  finalise: 'finish',
  finalize: 'finish',
  furnish: 'give',
  identify: 'find / name',
  illustrate: 'show',
  implement: 'do / start',
  incorporate: 'include',
  indicate: 'show',
  inform: 'tell',
  initiate: 'start',
  interrogate: 'ask',
  locate: 'find',
  maintain: 'keep',
  manufacture: 'make',
  maximise: 'increase',
  maximize: 'increase',
  minimise: 'decrease',
  minimize: 'decrease',
  mitigate: 'reduce',
  modify: 'change',
  necessitate: 'need',
  notify: 'tell',
  obligate: 'make',
  observe: 'see',
  obtain: 'get',
  optimise: 'improve',
  optimize: 'improve',
  originate: 'start / come from',
  participate: 'take part',
  perceive: 'see',
  perform: 'do',
  permit: 'let',
  possess: 'have',
  prioritise: 'put first',
  prioritize: 'put first',
  proceed: 'go on',
  procure: 'get',
  provide: 'give',
  purchase: 'buy / things you buy',
  quantify: 'measure',
  rectify: 'correct',
  reimburse: 'pay back',
  relocate: 'move',
  remit: 'send / pay',
  render: 'make',
  replicate: 'copy',
  request: 'ask for',
  require: 'need',
  reside: 'live',
  retain: 'keep',
  retrieve: 'get back',
  revise: 'change',
  scrutinise: 'examine',
  scrutinize: 'examine',
  stipulate: 'say',
  submit: 'send / give',
  substantiate: 'prove',
  summon: 'call',
  supplement: 'add to',
  terminate: 'stop',
  transmit: 'send',
  transpire: 'happen',
  undertake: 'do',
  utilise: 'use',
  utilize: 'use',
  validate: 'check',
  verify: 'check',
  witness: 'see',
  // Nouns
  assistance: 'help',
  beverage: 'drink',
  capability: 'ability',
  commencement: 'start',
  compensation: 'pay',
  component: 'part',
  dwelling: 'home',
  expenditure: 'cost / spending',
  inception: 'start',
  indication: 'sign',
  individual: 'person / people',
  magnitude: 'size',
  majority: 'most',
  methodology: 'method',
  objective: 'aim',
  parameter: 'limit',
  personnel: 'people / staff',
  portion: 'part',
  proficiency: 'skill',
  proportion: 'part / share',
  proximity: 'nearness',
  remainder: 'rest',
  remuneration: 'pay',
  requirement: 'need',
  residence: 'home',
  termination: 'end',
  utilisation: 'use',
  utilization: 'use',
  // Adjectives
  adequate: 'enough',
  additional: 'more',
  advantageous: 'helpful',
  aforementioned: 'this',
  apparent: 'clear',
  beneficial: 'good / helpful',
  cognizant: 'aware',
  commensurate: 'equal',
  considerable: 'large',
  equivalent: 'equal / same',
  erroneous: 'wrong',
  evident: 'clear',
  feasible: 'possible',
  identical: 'same',
  inadequate: 'not enough',
  initial: 'first',
  minimal: 'small',
  numerous: 'many',
  operational: 'working',
  optimal: 'best',
  permissible: 'allowed',
  potential: 'possible',
  practicable: 'possible',
  preceding: 'earlier',
  previous: 'earlier',
  principal: 'main',
  requisite: 'needed',
  significant: 'large / important',
  subsequent: 'next / later',
  substantial: 'large',
  sufficient: 'enough',
  supplementary: 'extra',
  viable: 'possible',
  // Adverbs and linking words
  accordingly: 'thus',
  actually: '(delete it)',
  alternatively: 'or',
  approximately: 'about',
  consequently: 'thus',
  currently: 'now',
  frequently: 'often',
  further: 'more',
  hence: 'thus',
  henceforth: 'from now on',
  however: 'but',
  initially: 'first',
  nevertheless: 'but / still',
  nonetheless: 'but / still',
  notwithstanding: 'despite',
  predominantly: 'mostly',
  presently: 'now',
  previously: 'before',
  promptly: 'quickly',
  significantly: 'much',
  solely: 'only',
  subsequently: 'then / later',
  sufficiently: 'enough',
  thereafter: 'then',
  thereby: 'thus',
  therefore: 'thus / so',
  typically: 'usually',
  ultimately: 'in the end',
  whereas: 'but',
  whereby: 'by which',
  whilst: 'while',
  // Prepositions and wordy phrases
  concerning: 'about',
  regarding: 'about',
  'a large number of': 'many',
  'a number of': 'some',
  'adjacent to': 'next to',
  'are able to': 'can',
  'as a consequence': 'thus',
  'as a result of': 'because of',
  'at present': 'now',
  'at the present time': 'now',
  'at this point in time': 'now',
  'by means of': 'with',
  'due to the fact that': 'because',
  'during the course of': 'during',
  'for the purpose of': 'to / for',
  'has the ability to': 'can',
  'in accordance with': 'as / under',
  'in addition': 'also',
  'in excess of': 'more than',
  'in lieu of': 'instead of',
  'in order to': 'to',
  'in spite of the fact that': 'although',
  'in the event that': 'if',
  'in the near future': 'soon',
  'in the vicinity of': 'near',
  'is able to': 'can',
  'on a daily basis': 'each day',
  'prior to': 'before',
  'provided that': 'if',
  'pursuant to': 'under',
  'until such time as': 'until',
  'with regard to': 'about',
  'with respect to': 'about',
  'with the exception of': 'except',
};

// Forms of "be" and "get" that start a passive. "being" and "been" also count, so
// "is being checked" and "has been found" are caught. "'s" is left out on purpose:
// "it's found" may mean "it has found" (active).
const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "'m", "'re"]);
const GET = new Set(['get', 'gets', 'got', 'gotten', 'getting']);
// Small words that can sit between "be" and the participle ("is not sent", "are often found").
const BETWEEN = new Set(['not', 'never', 'also', 'then', 'still', 'only', 'just', 'always', 'often', 'all', 'both', 'each', 'now', 'already', 'soon', 'sometimes', 'even', 'first', 'again', 'once', 'mostly', 'usually', 'rarely']);
// Past participles of common irregular verbs that take an object (so "be" + word is passive).
// Verbs that take no object ("gone", "fallen", "become", "born") cannot form a passive and are left out.
const IRREGULAR = new Set(('beaten bent bitten blown bought brought built burnt caught chosen cut dealt dug done drawn driven ' +
  'drunk eaten fed felt fought forgiven forgotten found given grown heard hidden hit held hurt kept known laid led lent lost ' +
  'made meant met paid put read ridden rung said seen sent set shaken shot shown sold sought spent spoken spread stolen struck ' +
  'sung sunk swept sworn taken taught thrown thought told torn understood woken won worn written').split(' '));
// Words after "be" or "get" that describe a state, not an action done to the subject. These are
// fine in STE (it lets you use a participle as an adjective): "the shop is closed", "you are tired".
const STATES = new Set(('advanced aged ashamed balanced biased broken closed complicated concerned confused crowded delighted ' +
  'detailed disappointed divorced embarrassed excited exhausted experienced finished fixed frightened frozen frustrated ' +
  'impressed interested left married mixed pleased qualified relaxed related retired satisfied scared shocked shut skilled ' +
  'sophisticated stressed stuck surprised talented tired worried').split(' '));
// Idioms with "get" that are not passive: "get lost", "get dressed", "get started", "get rid of", "get used to".
const GET_STATES = new Set(['lost', 'dressed', 'started', 'rid', 'used', 'involved']);
// Words that end in "-ed" but are not participles.
const NOT_ED = new Set(['hundred', 'sacred', 'naked', 'wicked', 'rugged', 'beloved', 'crooked', 'ragged', 'jagged', 'wretched', 'kindred', 'hatred', 'shed', 'sled', 'bled', 'fled']);

// Sentence-opening words that end in "-ing" but are plain nouns or prepositions, not verb forms,
// plus a few everyday names of things (STE lets an -ing word stand in a technical name).
// Words like "Thing", "Bring", "Spring", "King" are skipped because "-ing" is not a suffix there.
const ING_OK = new Set(['nothing', 'something', 'anything', 'everything', 'morning', 'evening', 'during', 'according', 'ceiling',
  'sibling', 'darling', 'pudding', 'lightning', 'herring', 'shilling', 'sterling', 'viking', 'beijing', 'wedding', 'earring',
  'offspring', 'seedling', 'duckling', 'clothing', 'inkling', 'building', 'heating', 'housing', 'parking', 'lighting', 'meeting']);
// Linking words that may come before the subject ("But dimming the screen helps").
const LINKS = new Set(['but', 'so', 'and', 'or', 'yet', 'then']);
const JOINS = new Set(['and', 'but', 'or']);

const clean = (w) => w.replace(/[’‘]/g, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
const endsClause = (w) => /[,;:.!?…)"”]$/.test(w);
const isCapital = (w) => /^\p{Lu}/u.test(w);

/** The forms of a word: require, requires, required, requiring; notify, notifies, notified. */
function forms(w) {
  const out = new Set([w, `${w}s`, `${w}es`, `${w}d`, `${w}ed`, `${w}ing`]);
  if (w.endsWith('e')) out.add(`${w.slice(0, -1)}ing`);
  if (/[^aeiou]y$/.test(w)) ['ies', 'ied'].forEach((s) => out.add(w.slice(0, -1) + s));
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) ['ed', 'ing'].forEach((s) => out.add(w + w.at(-1) + s));
  return [...out];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD_RULES = Object.entries(STE_WORDS).map(([word, use]) => ({
  word,
  use,
  re: new RegExp(
    `(?<![\\p{L}'])(?:${word.includes(' ') ? word.split(' ').map(esc).join('\\s+') : forms(word).join('|')})(?![\\p{L}'])`,
    'giu',
  ),
}));

/** Split into sentences at . ! ? … followed by a space or the end (so "2.5" stays whole). */
export function sentences(text) {
  return String(text)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

const say = (use) => use.split(' / ').map((u) => (u.startsWith('(') ? u : `"${u}"`)).join(' or ');

/** Is this word a past participle (regular "-ed" or a common irregular one)? */
function participle(w) {
  if (!w || isCapital(w)) return false; // a name, not a verb
  const x = w.toLowerCase();
  if (IRREGULAR.has(x)) return true;
  return x.length > 3 && x.endsWith('ed') && !x.endsWith('eed') && !NOT_ED.has(x);
}

/** Is this participle really a state ("closed", "tired", "unexplained")? */
function isState(w, after) {
  const x = w.toLowerCase();
  if (STATES.has(x)) return true;
  // "un-" + participle is an adjective ("unexplained", "unknown"): there is no verb "unexplain".
  if (x.startsWith('un') && participle(x.slice(2))) return true;
  return after === 'get' && GET_STATES.has(x);
}

/** Passive phrases in one sentence, as written: "is sent", "are often found", "got paid". */
function passives(sentence) {
  const raw = sentence.split(/\s+/);
  const words = raw.map(clean);
  const found = new Map();
  words.forEach((w, i) => {
    const lw = w.toLowerCase();
    const contraction = lw.match(/'(m|re)$/);
    const kind = BE.has(lw) || contraction ? 'be' : GET.has(lw) ? 'get' : null;
    if (!kind || endsClause(raw[i])) return;
    let j = i + 1;
    // Skip small words and adverbs ("not", "usually"), and a second "be" ("is being sent").
    while (j < words.length && j - i <= 3) {
      const n = words[j].toLowerCase();
      if (!(BETWEEN.has(n) || (n.endsWith('ly') && n.length > 3) || (kind === 'be' && BE.has(n)))) break;
      if (endsClause(raw[j])) return;
      j++;
    }
    const p = words[j];
    if (!participle(p) || isState(p, kind) || found.has(j)) return;
    if (kind === 'get' && p.toLowerCase() === 'used' && words[j + 1]?.toLowerCase() === 'to') return;
    found.set(j, raw.slice(i, j + 1).map(clean).join(' '));
  });
  return [...found.values()];
}

/** Every STE problem in a subtitle, as plain-English instructions. Empty array = fine. */
export function steProblems(text) {
  const problems = [];
  if (typeof text !== 'string' || !text.trim()) return problems;
  const add = (m) => problems.includes(m) || problems.push(m);

  // One idea per sentence: a semicolon joins two sentences into one. Split it.
  if (text.includes(';')) {
    const [a, b] = text.split(';').map((s) => s.trim().split(/\s+/));
    add(`Split "${a.slice(-2).join(' ')}; ${b.slice(0, 2).join(' ')}" into two sentences: use a full stop, not ";". Write one idea per sentence.`);
  }

  for (const s of sentences(text)) {
    const raw = s.split(/\s+/);
    const words = raw.map(clean).filter(Boolean);

    // Sentence length: STE caps a descriptive sentence at 25 words; subtitles keep to 20.
    if (words.length > STE_MAX_WORDS) {
      add(`"${s}" has ${words.length} words. Keep each sentence to ${STE_MAX_WORDS} words or fewer: split it into shorter sentences.`);
    }

    // One idea per sentence: two or more joins with "and"/"but"/"or" means three ideas.
    // A linking word that opens the sentence ("But ...") links to the previous line; it does not count.
    const joins = words.slice(1).filter((w) => JOINS.has(w.toLowerCase()));
    if (joins.length >= 2) {
      add(`"${s}" joins ideas with ${joins.map((j) => `"${j}"`).join(', ')}. Write one idea per sentence: split it.`);
    }

    // Active voice: STE uses the active voice as much as possible, so the viewer sees who acts.
    for (const p of passives(s)) {
      add(`"${p}" is passive. Use the active voice: say who does it (for example "you send the kit", not "the kit is sent").`);
    }

    // No -ing word as the subject: STE does not use the -ing form as a noun or to open a sentence.
    // Gentle on purpose: only the first word (after a linking word like "But") is checked.
    const first = words.findIndex((w) => !LINKS.has(w.toLowerCase()));
    const w = words[first];
    if (w && /ing$/i.test(w) && /[aeiouy]/i.test(w.slice(0, -3)) && w.length > 4 && !ING_OK.has(w.toLowerCase())) {
      add(`"${w}" opens the sentence as an -ing word. Name who or what acts and give it a plain verb (for example "The test finds...", not "Screening finds...").`);
    }

    // Approved words: use the plain word, not the long or formal one. A capital letter in the middle
    // of a sentence marks a name ("Individual Savings Account"), which is left alone.
    for (const { re, use, word } of WORD_RULES) {
      for (const m of s.matchAll(re)) {
        if (m.index > 0 && isCapital(m[0])) continue;
        const hint = use.startsWith('(') ? `Delete "${m[0]}": it adds nothing.` : `Use ${say(use)} instead of "${m[0]}"${m[0].toLowerCase() === word ? '' : ' (in the matching form)'}.`;
        add(hint);
      }
    }
  }
  return problems;
}
