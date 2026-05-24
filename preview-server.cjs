// Coursia Preview Server - Ultra-lightweight raw TCP server
// Uses net.createServer (NOT http.createServer) for minimal CPU usage
const net = require('net');
const fs = require('fs');
const path = require('path');
const PORT = 3000;
const BASE = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function getMime(url) {
  const dot = url.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  const ext = url.slice(dot);
  return MIME[ext] || 'application/octet-stream';
}

// Pre-load ALL assets into memory at startup
const cache = new Map();
let totalBytes = 0;

function loadDir(dir, urlPrefix) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const url = urlPrefix + '/' + entry.name;
      if (entry.isDirectory()) {
        loadDir(full, url);
      } else {
        const data = fs.readFileSync(full);
        cache.set(url, data);
        totalBytes += data.length;
      }
    }
  } catch (e) { /* skip */ }
}

// Load public/ (avatars, logo, favicon, etc.)
loadDir(path.join(BASE, 'public'), '');

// Load .next/static/ (JS chunks, CSS, fonts, media)
loadDir(path.join(BASE, '.next', 'static'), '/_next/static');

// Load pre-rendered index.html
const indexHtml = fs.readFileSync(path.join(BASE, '.next', 'server', 'app', 'index.html'));
cache.set('/', indexHtml);
totalBytes += indexHtml.length;

// Handle _next/image proxy (simple passthrough - serve original file)
function handleImageProxy(url) {
  // /_next/image?url=%2Flogo.png&w=256&q=75
  const params = new URLSearchParams(url.split('?')[1]);
  const imgUrl = decodeURIComponent(params.get('url') || '');
  if (imgUrl.startsWith('/')) {
    const found = cache.get(imgUrl);
    if (found) return found;
    // Try from public dir
    const fullPath = path.join(BASE, 'public', imgUrl);
    if (fs.existsSync(fullPath)) {
      const data = fs.readFileSync(fullPath);
      return data;
    }
  }
  return null;
}

console.log('Cache: ' + cache.size + ' files, ' + Math.round(totalBytes / 1024) + ' KB');

const server = net.createServer((sock) => {
  sock.setNoDelay(true);
  let buf = Buffer.alloc(0);

  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const headerEnd = buf.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    // Remove listener to prevent double processing
    sock.removeListener('data', onData);

    const headerStr = buf.slice(0, headerEnd).toString('utf-8');
    const firstLine = headerStr.split('\r\n')[0];
    const match = firstLine.match(/^(\S+)\s+(\S+)/);
    if (!match) { try { sock.destroy(); } catch(e) {} return; }

    let url;
    try { url = decodeURIComponent(match[2].split('?')[0]); } catch(e) { url = match[2].split('?')[0]; }
    const fullUrl = match[2]; // Keep query string for image proxy

    let body;
    let mime;
    let status = '200';

    // Route: /
    if (url === '/' || url === '') {
      body = indexHtml;
      mime = 'text/html; charset=utf-8';
    }
    // Route: /_next/image?...
    else if (url === '/_next/image') {
      body = handleImageProxy(fullUrl);
      if (body) mime = getMime(fullUrl);
      else { body = Buffer.from('Not Found'); mime = 'text/plain'; status = '404'; }
    }
    // Route: static cache
    else {
      body = cache.get(url);
      if (!body) {
        // Try with/without trailing slash
        if (url.endsWith('/') && url.length > 1) body = cache.get(url.slice(0, -1));
        else body = cache.get(url + '/');
      }
      if (body) {
        mime = getMime(url);
      } else {
        body = Buffer.from('Not Found');
        mime = 'text/plain';
        status = '404';
      }
    }

    const header = Buffer.from(
      'HTTP/1.1 ' + status + ' OK\r\n' +
      'Content-Type: ' + mime + '\r\n' +
      'Content-Length: ' + body.length + '\r\n' +
      'Cache-Control: public, max-age=3600\r\n' +
      'Connection: close\r\n' +
      '\r\n'
    );

    try {
      sock.write(header);
      sock.write(body);
      sock.end();
    } catch (e) { /* connection closed */ }
  };

  sock.on('data', onData);
  sock.on('error', () => {});
  sock.setTimeout(15000, () => { try { sock.destroy(); } catch(e) {} });
});

server.maxConnections = 50;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Coursia preview on port ' + PORT);
});

// Keep the process alive
setInterval(() => {}, 30000);
