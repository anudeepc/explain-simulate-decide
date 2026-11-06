// A tiny, safe arithmetic language for screenplay formulas.
// Numbers, + - * /, parentheses, min/max/round/pow/step, and value ids. Nothing else.
// Never uses eval or Function: the AI's text is parsed, not run.

const FUNCS = {
  min: { arity: [1, Infinity], fn: (...a) => Math.min(...a) },
  max: { arity: [1, Infinity], fn: (...a) => Math.max(...a) },
  // a switch: 1 while x is above zero, else 0 ("water flows while the tank has any")
  step: { arity: [1, 1], fn: (x) => (x > 0 ? 1 : 0) },
  // powers, for chances that repeat ("at least one positive in n tests" = 1 - (1 - p)^n)
  pow: { arity: [2, 2], fn: (x, y) => x ** y },
  round: {
    arity: [1, 2],
    fn: (x, d = 0) => {
      const f = 10 ** d;
      return Math.round(x * f) / f;
    },
  },
};

export class FormulaError extends Error {}

/** @param {string} src */
function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*/(),]))/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new FormulaError(`Unexpected character "${src.slice(i).trim()[0]}" in "${src}"`);
    if (m[1] !== undefined) tokens.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2] });
    else tokens.push({ t: m[3] });
    i = re.lastIndex;
  }
  return tokens;
}

/**
 * Parse a formula into an AST.
 * @param {string} src
 */
export function parse(src) {
  if (typeof src !== 'string' || !src.trim()) throw new FormulaError('Formula is empty');
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const take = (t) => {
    const tok = tokens[p];
    if (!tok || (t && tok.t !== t)) throw new FormulaError(`Expected ${t || 'a value'} in "${src}"`);
    p++;
    return tok;
  };

  function expr() {
    let node = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) node = { op: take().t, a: node, b: term() };
    return node;
  }
  function term() {
    let node = unary();
    while (peek() && (peek().t === '*' || peek().t === '/')) node = { op: take().t, a: node, b: unary() };
    return node;
  }
  function unary() {
    if (peek() && peek().t === '-') {
      take();
      return { op: 'neg', a: unary() };
    }
    if (peek() && peek().t === '+') {
      take();
      return unary();
    }
    return atom();
  }
  function atom() {
    const tok = peek();
    if (!tok) throw new FormulaError(`Formula ends too early: "${src}"`);
    if (tok.t === 'num') return { num: take().v };
    if (tok.t === '(') {
      take();
      const e = expr();
      take(')');
      return e;
    }
    if (tok.t === 'id') {
      take();
      if (peek() && peek().t === '(') {
        const f = FUNCS[tok.v];
        if (!Object.hasOwn(FUNCS, tok.v)) throw new FormulaError(`"${tok.v}" is not an allowed function (use min, max, round, pow, step)`);
        take('(');
        const args = [];
        if (peek() && peek().t !== ')') {
          args.push(expr());
          while (peek() && peek().t === ',') {
            take();
            args.push(expr());
          }
        }
        take(')');
        if (args.length < f.arity[0] || args.length > f.arity[1]) throw new FormulaError(`${tok.v}() got ${args.length} arguments`);
        return { call: tok.v, args };
      }
      if (['this', 'constructor', '__proto__', 'prototype'].includes(tok.v)) throw new FormulaError(`"${tok.v}" is not allowed`);
      return { ref: tok.v };
    }
    throw new FormulaError(`Unexpected "${tok.t}" in "${src}"`);
  }

  const ast = expr();
  if (p !== tokens.length) throw new FormulaError(`Unexpected "${tokens[p].v ?? tokens[p].t}" in "${src}"`);
  return ast;
}

/**
 * @param {any} ast
 * @param {Record<string, number>} scope
 * @returns {number}
 */
export function evaluate(ast, scope) {
  if ('num' in ast) return ast.num;
  if ('ref' in ast) {
    if (!Object.hasOwn(scope, ast.ref)) throw new FormulaError(`Unknown value "${ast.ref}"`);
    return Number(scope[ast.ref]);
  }
  if ('call' in ast) return FUNCS[ast.call].fn(...ast.args.map((a) => evaluate(a, scope)));
  const a = evaluate(ast.a, scope);
  switch (ast.op) {
    case 'neg': return -a;
    case '+': return a + evaluate(ast.b, scope);
    case '-': return a - evaluate(ast.b, scope);
    case '*': return a * evaluate(ast.b, scope);
    case '/': return a / evaluate(ast.b, scope);
  }
  throw new FormulaError('Bad formula tree');
}

/** All value ids a formula reads. */
export function refs(ast, out = new Set()) {
  if ('ref' in ast) out.add(ast.ref);
  else if ('call' in ast) ast.args.forEach((a) => refs(a, out));
  else if ('op' in ast) {
    refs(ast.a, out);
    if (ast.b) refs(ast.b, out);
  }
  return [...out];
}

/**
 * Parse formulas and order them so each runs after the values it reads.
 * @param {{id: string, formula: string}[]} defs
 * @param {string[]} inputIds
 * @returns {{id: string, ast: any}[]}
 */
export function orderFormulas(defs, inputIds) {
  const parsed = new Map(defs.map((d) => [d.id, { id: d.id, ast: parse(d.formula) }]));
  const known = new Set([...inputIds, ...parsed.keys()]);
  for (const { id, ast } of parsed.values()) {
    for (const r of refs(ast)) if (!known.has(r)) throw new FormulaError(`Formula for "${id}" uses unknown value "${r}"`);
  }
  const out = [];
  const state = new Map(); // 1 = visiting, 2 = done
  const visit = (id, path) => {
    if (!parsed.has(id) || state.get(id) === 2) return;
    if (state.get(id) === 1) throw new FormulaError(`Circular formula: ${[...path, id].join(' → ')}`);
    state.set(id, 1);
    for (const r of refs(parsed.get(id).ast)) visit(r, [...path, id]);
    state.set(id, 2);
    out.push(parsed.get(id));
  };
  for (const id of parsed.keys()) visit(id, []);
  return out;
}
