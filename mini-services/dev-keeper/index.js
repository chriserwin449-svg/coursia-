const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const LOG = '/home/z/my-project/dev.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG, line); } catch {}
}

function startServer() {
  log('Starting Next.js dev server...');
  const proc = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  proc.stdout.on('data', (d) => process.stdout.write(d));
  proc.stderr.on('data', (d) => process.stderr.write(d));
  
  proc.on('exit', (code, sig) => {
    log(`Next.js exited: code=${code} signal=${sig}, restarting in 2s...`);
    setTimeout(startServer, 2000);
  });
  
  return proc;
}

let server = startServer();

// Periodic keepalive: hit the Next.js server every 10s
setInterval(() => {
  http.get('http://127.0.0.1:3000', (res) => {
    // silent
  }).on('error', () => {
    // silent - server might be restarting
  });
}, 10000);

log('Dev keeper running - will auto-restart Next.js if it dies');
