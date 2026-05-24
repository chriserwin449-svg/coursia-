// Coursia Preview Watchdog - Auto-restarts the preview server
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, 'preview-server.cjs');
const LOG = path.join(__dirname, 'dev.log');

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { fs.appendFileSync(LOG, line); } catch (e) {}
}

function start() {
  log('Starting preview server...');
  const child = spawn('node', [SERVER], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) {
      log('[SRV] ' + msg);
      process.stdout.write(msg + '\n');
    }
  });

  child.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) log('[ERR] ' + msg);
  });

  child.on('exit', (code) => {
    log('Server exited (code=' + code + '), restarting in 1s...');
    setTimeout(start, 1000);
  });

  child.on('error', (err) => {
    log('Spawn error: ' + err.message + ', restarting in 2s...');
    setTimeout(start, 2000);
  });
}

log('=== Watchdog started ===');
start();

// Keep watchdog alive
setInterval(() => {}, 60000);
