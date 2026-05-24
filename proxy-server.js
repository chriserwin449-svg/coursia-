const http = require('http');
const { execSync, spawn } = require('child_process');
const net = require('net');

const NEXT_PORT = 3001;
let nextReady = false;
let nextProcess = null;

function startNext() {
  if (nextProcess) return;
  console.log('[proxy] Starting Next.js on port ' + NEXT_PORT + '...');
  nextProcess = spawn('node', [
    'node_modules/.bin/next', 'start', '-p', String(NEXT_PORT), '-H', '127.0.0.1'
  ], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  nextProcess.stdout.on('data', d => {
    const msg = d.toString();
    process.stdout.write(msg);
    if (msg.includes('Ready')) nextReady = true;
  });
  nextProcess.stderr.on('data', d => process.stderr.write(d.toString()));
  nextProcess.on('exit', () => { nextProcess = null; nextReady = false; });
}

// Try to connect to Next.js
function checkNext(cb) {
  const s = net.connect(NEXT_PORT, '127.0.0.1', () => { s.destroy(); cb(true); });
  s.on('error', () => { s.destroy(); cb(false); });
  s.setTimeout(2000, () => { s.destroy(); cb(false); });
}

// Proxy request to Next.js
function proxy(req, res) {
  const opts = {
    hostname: '127.0.0.1',
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:3000' }
  };
  
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('502 Next.js not ready');
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (nextReady) {
    proxy(req, res);
  } else {
    // Start Next.js if not running
    if (!nextProcess) startNext();
    // Wait up to 15s for Next.js to be ready
    let attempts = 0;
    const maxAttempts = 30;
    const tryProxy = () => {
      checkNext((ok) => {
        if (ok) {
          nextReady = true;
          proxy(req, res);
        } else if (attempts++ < maxAttempts) {
          setTimeout(tryProxy, 500);
        } else {
          res.writeHead(504, { 'Content-Type': 'text/plain' });
          res.end('504 Next.js startup timeout');
        }
      });
    };
    tryProxy();
  }
});

server.listen(3000, '127.0.0.1', () => {
  console.log('[proxy] Listening on 127.0.0.1:3000 — auto-starting Next.js');
  startNext();
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('[proxy] Port 3000 in use, exiting');
  }
});
