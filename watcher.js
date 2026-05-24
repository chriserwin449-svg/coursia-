const http = require('http');
const { spawn } = require('child_process');
const net = require('net');

let nextProc = null;

function startNext() {
  if (nextProc) {
    try { nextProc.kill('SIGTERM'); } catch(e) {}
    nextProc = null;
  }
  console.log('[watcher] Starting Next.js...');
  nextProc = spawn('npx', ['next', 'start', '-p', '3001', '-H', '127.0.0.1'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  nextProc.on('exit', (code) => {
    console.log('[watcher] Next.js exited (' + code + '), restarting in 3s...');
    nextProc = null;
    setTimeout(startNext, 3000);
  });
  nextProc.on('error', () => {
    console.log('[watcher] Next.js error, restarting...');
    nextProc = null;
    setTimeout(startNext, 3000);
  });
}

function checkNext(cb) {
  const s = net.connect(3001, '127.0.0.1', () => { s.destroy(); cb(true); });
  s.on('error', () => { s.destroy(); cb(false); });
  s.setTimeout(1000, () => { s.destroy(); cb(false); });
}

// Lightweight proxy on 3000 that forwards to 3001
http.createServer((req, res) => {
  checkNext(ok => {
    if (!ok) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Coursia démarre... réessaie dans 3 secondes.</h2><script>setTimeout(()=>location.reload(),3000)</script></body></html>');
      return;
    }
    const proxy = http.request({
      hostname: '127.0.0.1', port: 3001,
      path: req.url, method: req.method, headers: req.headers
    }, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxy.on('error', () => {
      res.writeHead(502);
      res.end('Restarting...');
    });
    req.pipe(proxy);
  });
}).listen(3000, '127.0.0.1', () => {
  console.log('[watcher] Proxy on :3000');
  startNext();
});
