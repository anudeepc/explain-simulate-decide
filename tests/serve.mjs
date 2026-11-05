// Tiny static server for browser checks.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown', '.css': 'text/css', '.png': 'image/png' };

export function serve(root = resolve('.')) {
  const server = createServer(async (req, res) => {
    try {
      let p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(root)) throw new Error('outside');
      if (p.endsWith('/')) p += 'index.html';
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  }).listen(0);
  return { url: `http://localhost:${server.address().port}`, close: () => server.close() };
}
