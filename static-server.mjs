import { createServer } from 'http';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const PORT = 3000;
const NEXT_DIR = '/home/z/my-project/.next';
const PUBLIC_DIR = '/home/z/my-project/public';
const BUILD_ID = readFileSync(join(NEXT_DIR, 'BUILD_ID'), 'utf-8').trim();
const indexHtml = readFileSync(join(NEXT_DIR, 'server', 'app', 'index.html'), 'utf-8');

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

function chunkedSend(res, data, contentType) {
  res.writeHead(200, { 'Content-Type': contentType, 'Transfer-Encoding': 'chunked' });
  let off = 0;
  const sz = 8192;
  (function next() {
    if (off < data.length) {
      res.write(data.subarray(off, off + sz));
      off += sz;
      setImmediate(next);
    } else {
      res.end();
    }
  })();
}

function small(res, data, contentType) {
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(data);
}

function serveFile(res, filePath, fallback) {
  if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
    const data = readFileSync(filePath);
    const ext = extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    if (data.length > 16384) {
      chunkedSend(res, data, mime);
    } else {
      small(res, data, mime);
    }
    return true;
  }
  return false;
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // Homepage
    if (path === '/') {
      chunkedSend(res, Buffer.from(indexHtml, 'utf-8'), 'text/html; charset=utf-8');
      return;
    }

    // Public files
    if (serveFile(res, join(PUBLIC_DIR, path))) return;

    // _next/static
    if (path.startsWith('/_next/static/')) {
      if (serveFile(res, join(NEXT_DIR, path))) return;
    }

    // BUILD_ID
    if (path === '/_next/BUILD_ID') {
      small(res, BUILD_ID, 'text/plain');
      return;
    }

    // _next routes - try file system
    if (path.startsWith('/_next/')) {
      const np = join(NEXT_DIR, path);
      if (serveFile(res, np)) return;

      // JSON manifest fallbacks
      if (path.endsWith('.json')) {
        // Try to find the actual manifest file
        const manifests = [
          join(NEXT_DIR, 'static', path.replace('/_next/', '')),
          join(NEXT_DIR, path),
        ];
        for (const m of manifests) {
          if (existsSync(m)) {
            serveFile(res, m);
            return;
          }
        }
        small(res, '{}', 'application/json');
        return;
      }

      // RSC routes
      if (path.endsWith('.rsc')) {
        small(res, '', 'text/plain');
        return;
      }
    }

    // Client JS chunks - look for them in multiple locations
    if (path.endsWith('.js') || path.endsWith('.css')) {
      const locations = [
        join(NEXT_DIR, 'static', 'chunks', 'app', path.split('/').pop() || ''),
        join(NEXT_DIR, 'static', path.replace(/^\/_next\//, '')),
        join(NEXT_DIR, path),
      ];
      for (const loc of locations) {
        if (serveFile(res, loc)) return;
      }
    }

    // SPA fallback
    chunkedSend(res, Buffer.from(indexHtml, 'utf-8'), 'text/html; charset=utf-8');
  } catch (err) {
    console.error('Error ' + path + ':', err.message);
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Coursia on :' + PORT + ' build=' + BUILD_ID);
});
