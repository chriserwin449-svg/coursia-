import { createServer } from 'http';
import { readFileSync, existsSync, statSync, createReadStream } from 'fs';
import { join, extname } from 'path';
import { createGzip } from 'zlib';

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
};

function sendChunked(res, data, contentType) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Transfer-Encoding': 'chunked',
  });
  const chunkSize = 8192;
  let offset = 0;
  const send = () => {
    if (offset < data.length) {
      res.write(data.slice(offset, offset + chunkSize));
      offset += chunkSize;
      setImmediate(send);
    } else {
      res.end();
    }
  };
  send();
}

function sendSmall(res, data, contentType, extra = {}) {
  res.writeHead(200, { 'Content-Type': contentType, ...extra });
  res.end(data);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // Homepage
    if (path === '/' || path === '/index.html') {
      sendChunked(res, indexHtml, 'text/html; charset=utf-8');
      return;
    }

    // _next/static
    if (path.startsWith('/_next/static/')) {
      const fp = join(NEXT_DIR, path);
      if (existsSync(fp) && !statSync(fp).isDirectory()) {
        const ext = extname(fp);
        const data = readFileSync(fp);
        sendChunked(res, data, MIME[ext] || 'application/octet-stream');
        return;
      }
    }

    // _next/BUILD_ID
    if (path === '/_next/BUILD_ID') {
      sendSmall(res, BUILD_ID, 'text/plain');
      return;
    }

    // _next JSON manifests
    if (path.startsWith('/_next/') && path.endsWith('.json')) {
      sendSmall(res, '{}', 'application/json');
      return;
    }

    // _next/image
    if (path.startsWith('/_next/image')) {
      sendSmall(res, '{}', 'application/json');
      return;
    }

    // Try _next files
    if (path.startsWith('/_next/')) {
      const np = join(NEXT_DIR, path);
      if (existsSync(np) && !statSync(np).isDirectory()) {
        const ext = extname(np);
        const data = readFileSync(np);
        sendChunked(res, data, MIME[ext] || 'application/octet-stream');
        return;
      }
    }

    // Public files (avatars, logo, etc.)
    const pubPath = join(PUBLIC_DIR, path);
    if (existsSync(pubPath) && !statSync(pubPath).isDirectory()) {
      const ext = extname(pubPath);
      const data = readFileSync(pubPath);
      sendChunked(res, data, MIME[ext] || 'application/octet-stream');
      return;
    }

    // SPA fallback - serve index.html for client-side routing
    sendChunked(res, indexHtml, 'text/html; charset=utf-8');
  } catch (err) {
    console.error('Error serving ' + path + ':', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Coursia static server on port ' + PORT);
});
