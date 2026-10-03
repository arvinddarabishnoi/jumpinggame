/* tools/serve.mjs — a zero-dependency static file server for the game.
 * ES modules and fetch() need a real http origin, so open the game through
 * this instead of double-clicking index.html:
 *
 *     node tools/serve.mjs            # http://localhost:8080
 *     node tools/serve.mjs 3000       # pick a port
 *     node tools/serve.mjs 3000 0.0.0.0
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HOST = process.argv[3] || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('nope'); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (e, buf) => {
      if (e) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + url);
        console.log('404', url);
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache',
      }).end(buf);
      console.log('200', url);
    });
  });
}).listen(PORT, HOST, () => {
  console.log(`Ember Knight running on http://localhost:${PORT}  (serving ${ROOT})`);
});
