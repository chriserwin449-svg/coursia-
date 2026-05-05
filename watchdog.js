const { spawn } = require('child_process');
const path = require('path');

const dir = path.resolve(__dirname);
let child = null;
let restarting = false;

function start() {
  console.log('[watchdog] Starting Next.js dev server...');
  child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    cwd: dir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  child.on('close', (code) => {
    console.log(`[watchdog] Next.js exited with code ${code}`);
    if (!restarting) {
      restarting = true;
      setTimeout(() => {
        restarting = false;
        start();
      }, 2000);
    }
  });

  child.on('error', (err) => {
    console.error('[watchdog] Error:', err.message);
  });
}

start();

process.on('SIGTERM', () => {
  if (child) child.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  if (child) child.kill();
  process.exit(0);
});
