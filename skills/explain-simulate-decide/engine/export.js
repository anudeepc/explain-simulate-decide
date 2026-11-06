// Builds one offline HTML file: engine modules as data: URLs in an import map,
// the screenplay as inert JSON, binary assets (the rigged people) as inert base64 blocks,
// and a strict Content-Security-Policy.

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' data:",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'media-src data: blob:',
  'connect-src data: blob:',
  'font-src data:',
  'worker-src blob:',
].join('; ');

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const safeJson = (obj) => JSON.stringify(obj).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function base64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Binary files the rigged people need (engine/assets/<name>.glb); cast/human.js reads them back. */
export const HUMAN_ASSETS = ['human-male', 'human-female', 'hair', 'moves'];

/** Does this bundle include the rigged people, so the page must carry their assets? */
export const needsHumans = (bundle) => Object.keys(bundle.modules).some((k) => k.endsWith('cast/human.js'));

/** Bytes → base64 (Node and browsers). */
export function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Read the people's assets for a page, if the bundle needs them.
 * @param {{modules: Record<string,string>}} bundle
 * @param {(name: string) => Promise<Uint8Array|ArrayBuffer>|Uint8Array|ArrayBuffer} readAsset reads engine/assets/<name>.glb
 * @param {any} [screenplay] when given, a film with no scene shots has no people to carry
 * @returns {Promise<Record<string, string>>} name → base64
 */
export async function assetsFor(bundle, readAsset, screenplay) {
  if (!needsHumans(bundle)) return {};
  if (screenplay && !(screenplay.explain || []).some((s) => s.shot === 'scene')) return {};
  const out = {};
  for (const name of HUMAN_ASSETS) out[name] = bytesToBase64(await readAsset(name));
  return out;
}

// inert base64 blocks (never run: not a script type the browser executes)
const assetTags = (assets = {}) =>
  Object.entries(assets)
    .map(([name, b64]) => `<script type="application/octet-stream" id="esd-asset-${escapeHtml(name)}">${String(b64).replace(/[^A-Za-z0-9+/=]/g, '')}</script>\n`)
    .join('');

/**
 * @param {any} screenplay
 * @param {{modules: Record<string,string>, entryKey: string}} bundle
 * @param {{title?: string, options?: any, assets?: Record<string, string>}} [opts] assets: name → base64
 */
export function toHtml(screenplay, bundle, opts = {}) {
  const imports = {};
  for (const [key, src] of Object.entries(bundle.modules)) imports[key] = `data:text/javascript;base64,${base64(src)}`;
  const title = opts.title || screenplay.question || 'Explain, Simulate, Decide';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${escapeHtml(title)}</title>
<meta name="generator" content="explain-simulate-decide">
<style>html,body{margin:0;height:100%;background:#efe9df;overflow:hidden}#esd-root{position:fixed;inset:0}</style>
</head>
<body>
<div id="esd-root" aria-label="${escapeHtml(title)}"></div>
<script type="application/json" id="esd-screenplay">${safeJson(screenplay)}</script>
<script type="application/json" id="esd-options">${safeJson(opts.options || {})}</script>
${assetTags(opts.assets)}<script type="importmap">${JSON.stringify({ imports })}</script>
<script type="module">
import { mount } from '${bundle.entryKey}';
const read = (id) => JSON.parse(document.getElementById(id).textContent);
window.ESD = mount(document.getElementById('esd-root'), read('esd-screenplay'), read('esd-options'));
</script>
</body>
</html>
`;
}
