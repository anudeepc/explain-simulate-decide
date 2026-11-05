// Builds one offline HTML file: engine modules as data: URLs in an import map,
// the screenplay as inert JSON, and a strict Content-Security-Policy.

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

/**
 * @param {any} screenplay
 * @param {{modules: Record<string,string>, entryKey: string}} bundle
 * @param {{title?: string, options?: any}} [opts]
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
<script type="importmap">${JSON.stringify({ imports })}</script>
<script type="module">
import { mount } from '${bundle.entryKey}';
const read = (id) => JSON.parse(document.getElementById(id).textContent);
window.ESD = mount(document.getElementById('esd-root'), read('esd-screenplay'), read('esd-options'));
</script>
</body>
</html>
`;
}
