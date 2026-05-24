const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const LOG = '/home/z/my-project/dev.log';
let serverProcess = null;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG, line); } catch {}
}

function startServer() {
  if (serverProcess) {
    try { serverProcess.kill('SIGTERM'); } catch {}
  }
  
  log('Starting Next.js dev server...');
  serverProcess = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  serverProcess.stdout.on('data', (d) => {
    process.stdout.write(d);
  });
  serverProcess.stderr.on('data', (d) => {
    process.stderr.write(d);
  });
  
  serverProcess.on('exit', () => {
    log('Next.js exited, restarting in 3s...');
    serverProcess = null;
    setTimeout(startServer, 3000);
  });
}

startServer();

// Keepalive ping every 10s
setInterval(() => {
  const req = http.get('http://127.0.0.1:3000', () => {});
  req.on('error', () => {});
  req.setTimeout(3000, () => { req.destroy(); });
}, 10000);

log('Server keeper started');
