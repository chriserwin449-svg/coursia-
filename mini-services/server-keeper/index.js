const { spawn } = require('child_process');
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
    try { fs.appendFileSync(LOG, d.toString()); } catch {}
  });
  serverProcess.stderr.on('data', (d) => {
    process.stderr.write(d);
    try { fs.appendFileSync(LOG, d.toString()); } catch {}
  });
  
  serverProcess.on('exit', (code) => {
    log(`Next.js exited (code: ${code}), restarting in 3s...`);
    serverProcess = null;
    setTimeout(startServer, 3000);
  });
}

startServer();
log('Server keeper started');
