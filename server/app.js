const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { getTournament, getGame } = require('./tournament');

const DIST = path.join(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res, pathname) {
  try {
    if (pathname === '/api/tournament') {
      const { value, stale, error } = await getTournament();
      const { _cacheMs, ...data } = value;
      return sendJson(res, 200, { ...data, stale, error: error || null });
    }
    const m = pathname.match(/^\/api\/game\/(\d+)$/);
    if (m) {
      const { value, stale } = await getGame(m[1]);
      return sendJson(res, 200, { ...value, stale });
    }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(`[api] ${pathname}: ${err.message}`);
    return sendJson(res, 502, { error: 'Could not reach ESPN. Try again shortly.' });
  }
}

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST + path.sep)) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const body = await fs.readFile(file);
    const hashed = rel.startsWith('assets/');
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    // SPA fallback
    try {
      const html = await fs.readFile(path.join(DIST, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('No build found. Run `npm run build` first, or use `npm run dev`.');
    }
  }
}

function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return sendJson(res, 400, { error: 'Bad request' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
    if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
    return serveStatic(res, pathname);
  });
}

function start(port = Number(process.env.PORT) || 3000) {
  const server = createServer();
  server.listen(port, () => console.log(`Players Era bracket → http://localhost:${port}`));
  return server;
}

module.exports = { createServer, start };
