const { createServer } = require('http');
const { spawn } = require('child_process');
const path = require('path');

const NEXT_DIR = '/home/z/my-project';
const PORT = 3001;

let nextProcess = null;
let nextReady = false;

function startNext() {
  console.log('[proxy] Starting Next.js...');
  nextReady = false;
  nextProcess = spawn('node', [
    path.join(NEXT_DIR, 'node_modules/.bin/next'),
    'start',
    '-p', '3002'
  ], {
    cwd: NEXT_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '3002' }
  });

  nextProcess.stdout.on('data', (d) => {
    const s = d.toString();
    process.stdout.write(s);
    if (s.includes('Ready')) nextReady = true;
  });
  nextProcess.stderr.on('data', (d) => {
    const s = d.toString();
    process.stderr.write(s);
    if (s.includes('Ready')) nextReady = true;
  });

  nextProcess.on('close', (code) => {
    console.log(`[proxy] Next.js exited (${code}), restarting...`);
    setTimeout(startNext, 2000);
  });
  nextProcess.on('error', (err) => {
    console.error('[proxy] Error:', err.message);
    setTimeout(startNext, 2000);
  });
}

// Proxy server on PORT that forwards to Next.js on port 3002
const proxy = createServer((req, res) => {
  if (!nextReady || !nextProcess) {
    res.writeHead(502);
    res.end('Next.js starting...');
    return;
  }
  
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', () => {
    res.writeHead(502);
    res.end('Bad Gateway');
  });
  
  req.pipe(proxyReq);
});

proxy.listen(PORT, () => {
  console.log(`[proxy] Proxy listening on :${PORT}, Next.js on :3002`);
  startNext();
});
