const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const NEXT_DIR = '/home/z/my-project/.next';
const PUBLIC_DIR = '/home/z/my-project/public';

const BUILD_ID = fs.readFileSync(path.join(NEXT_DIR, 'BUILD_ID'), 'utf-8').trim();
const indexHtml = fs.readFileSync(path.join(NEXT_DIR, 'server', 'app', 'index.html'), 'utf-8');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.rsc': 'text/plain',
};

// Pre-load all public files into memory (they're small)
const publicCache = {};
function loadPublicDir(dir, prefix) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const route = prefix + '/' + item.name;
      if (item.isDirectory()) {
        loadPublicDir(fullPath, route);
      } else {
        try {
          publicCache[route] = fs.readFileSync(fullPath);
        } catch (e) {}
      }
    }
  } catch (e) {}
}
loadPublicDir(PUBLIC_DIR, '');

// Cache for _next static files
const nextCache = {};
function loadNextStatic(dir, prefix) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const route = prefix + '/' + item.name;
      if (item.isDirectory()) {
        loadNextStatic(fullPath, route);
      } else {
        try {
          nextCache[route] = fs.readFileSync(fullPath);
        } catch (e) {}
      }
    }
  } catch (e) {}
}
loadNextStatic(path.join(NEXT_DIR, 'static'), '/_next/static');

function sendBuf(res, buf, contentType) {
  res.writeHead(200, { 'Content-Type': contentType, 'Connection': 'close', 'Content-Length': buf.length });
  res.end(buf);
}

function streamHtml(res) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Connection': 'close',
    'Content-Length': Buffer.byteLength(indexHtml),
  });
  const chunk = 4096;
  let i = 0;
  function write() {
    if (i < indexHtml.length && !res.destroyed) {
      res.write(indexHtml.substring(i, i + chunk));
      i += chunk;
      setTimeout(write, 1);
    } else if (!res.destroyed) {
      res.end();
    }
  }
  write();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:' + PORT);
  const p = url.pathname;

  try {
    if (p === '/') {
      streamHtml(res);
      return;
    }

    if (p === '/_next/BUILD_ID') {
      sendBuf(res, BUILD_ID, 'text/plain');
      return;
    }

    // Check public cache
    const pubKey = p;
    if (publicCache[pubKey]) {
      const ext = path.extname(p);
      sendBuf(res, publicCache[pubKey], MIME[ext] || 'application/octet-stream');
      return;
    }

    // Check _next static cache
    if (nextCache[p]) {
      const ext = path.extname(p);
      sendBuf(res, nextCache[p], MIME[ext] || 'application/octet-stream');
      return;
    }

    // Try loading from disk as fallback
    const diskPaths = [
      path.join(NEXT_DIR, p),
      path.join(NEXT_DIR, 'static', p.replace(/^\/_next\//, '')),
    ];
    const ext = path.extname(p);
    for (const dp of diskPaths) {
      try {
        if (fs.existsSync(dp) && !fs.statSync(dp).isDirectory()) {
          sendBuf(res, fs.readFileSync(dp), MIME[ext] || 'application/octet-stream');
          return;
        }
      } catch (e) {}
    }

    // JSON fallback
    if (p.endsWith('.json')) {
      sendBuf(res, '{}', 'application/json');
      return;
    }

    // SPA fallback
    streamHtml(res);
  } catch (err) {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.on('error', (e) => console.log('Err:', e.message));
server.listen(PORT, '0.0.0.0', () => console.log('Coursia on :' + PORT));
