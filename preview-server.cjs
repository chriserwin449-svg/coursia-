const http = require('http');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const N = '/home/z/my-project/.next';
const P = '/home/z/my-project/public';
const BID = fs.readFileSync(N + '/BUILD_ID', 'utf8').trim();
const HTML = fs.readFileSync(N + '/server/app/index.html', 'utf8');
const gzHTML = zlib.gzipSync(Buffer.from(HTML));

// Pre-gzip public files
const pubCache = {};
try {
  for (const f of fs.readdirSync(P, { withFileTypes: true })) {
    const fp = path.join(P, f.name);
    if (!f.isDirectory()) {
      try {
        const raw = fs.readFileSync(fp);
        pubCache['/' + f.name] = { raw, gz: zlib.gzipSync(raw) };
      } catch (e) {}
    }
  }
  // Avatars
  try {
    for (const f of fs.readdirSync(P + '/avatars')) {
      const raw = fs.readFileSync(P + '/avatars/' + f);
      pubCache['/avatars/' + f] = { raw, gz: zlib.gzipSync(raw) };
    }
  } catch (e) {}
} catch (e) {}

// Pre-gzip needed static chunks
const chunkCache = {};
const neededChunks = [
  '/_next/static/chunks/2473c16c0c2f6b5f.css',
  '/_next/static/chunks/4b1ff776d54bd948.css',
  '/_next/static/chunks/556c8b59b4c9a879.js',
  '/_next/static/chunks/ee40bf07a09d2a01.js',
  '/_next/static/chunks/fb6efb343d9465e5.js',
  '/_next/static/chunks/turbopack-0a2a6966991f5695.js',
  '/_next/static/chunks/ff1a16fafef87110.js',
  '/_next/static/chunks/d2be314c3ece3fbe.js',
  '/_next/static/chunks/51c2a4d658655669.js',
  '/_next/static/chunks/74dce9c506668f51.js',
  '/_next/static/chunks/333eb69a67954787.js',
  '/_next/static/chunks/a6dad97d9634a72d.js',
];
for (const c of neededChunks) {
  try {
    const raw = fs.readFileSync(N + c);
    chunkCache[c] = { raw, gz: zlib.gzipSync(raw) };
  } catch (e) {}
}

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'application/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function sendGz(res, gz, contentType) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Encoding': 'gzip',
    'Content-Length': gz.length,
    'Connection': 'close',
  });
  res.end(gz);
}

function sendRaw(res, raw, contentType) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': raw.length,
    'Connection': 'close',
  });
  res.end(raw);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const qIdx = url.indexOf('?');
  const p = qIdx >= 0 ? url.substring(0, qIdx) : url;
  const acceptGz = (req.headers['accept-encoding'] || '').includes('gzip');

  try {
    if (p === '/') {
      sendGz(res, gzHTML, 'text/html;charset=utf-8');
      if (global.gc) global.gc();
      return;
    }

    if (p === '/_next/BUILD_ID') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': BID.length, 'Connection': 'close' });
      res.end(BID);
      return;
    }

    // Public cache
    if (pubCache[p]) {
      const c = pubCache[p];
      const ext = path.extname(p);
      const mime = MIME[ext] || 'application/octet-stream';
      if (acceptGz && ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
        sendGz(res, c.gz, mime);
      } else {
        sendRaw(res, c.raw, mime);
      }
      if (global.gc) global.gc();
      return;
    }

    // Chunk cache
    if (chunkCache[p]) {
      const c = chunkCache[p];
      const ext = path.extname(p);
      if (acceptGz) sendGz(res, c.gz, MIME[ext] || 'application/javascript');
      else sendRaw(res, c.raw, MIME[ext] || 'application/javascript');
      if (global.gc) global.gc();
      return;
    }

    // JSON fallback
    if (p.endsWith('.json')) {
      const d = '{}';
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': 2, 'Connection': 'close' });
      res.end(d);
      return;
    }

    // SPA fallback
    sendGz(res, gzHTML, 'text/html;charset=utf-8');
    if (global.gc) global.gc();
  } catch (e) {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Preview server on :3000 (gzipped)');
});
