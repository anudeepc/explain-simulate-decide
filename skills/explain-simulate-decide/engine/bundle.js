// A tiny module inliner (no bundler needed). Walks static relative imports from an
// entry file and rewrites them to bare "@esd/<path>" keys, so every module can be
// placed in an import map as a data: URL inside one offline HTML file.
// Works in Node (fs) and the browser (fetch): you pass readFile.

export const KEY = '@esd/';

const FROM = /((?:^|\n)\s*(?:import|export)\b[^'"`;]*?\bfrom\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;
const BARE = /((?:^|\n)\s*import\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;

function join(dir, rel) {
  const parts = dir ? dir.split('/') : [];
  for (const seg of rel.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}
const dirname = (p) => p.split('/').slice(0, -1).join('/');

/**
 * @param {string} entry path relative to the engine root, e.g. "player.js"
 * @param {(path: string) => Promise<string>|string} readFile
 * @returns {Promise<{modules: Record<string, string>, entryKey: string}>}
 */
export async function inline(entry, readFile) {
  const modules = {};
  const queue = [entry];
  while (queue.length) {
    const path = queue.shift();
    const key = KEY + path;
    if (key in modules) continue;
    modules[key] = ''; // reserve to avoid revisits
    const src = await readFile(path);
    const rewrite = (_, head, q, rel) => {
      const target = join(dirname(path), rel);
      queue.push(target);
      return `${head}${q}${KEY}${target}${q}`;
    };
    modules[key] = src.replace(FROM, rewrite).replace(BARE, rewrite);
  }
  return { modules, entryKey: KEY + entry };
}
