const { spawn } = require('child_process');
const fs = require('fs');

const log = (msg) => {
  fs.appendFileSync('/home/z/my-project/wrapper.log', `${new Date().toISOString()} ${msg}\n`);
};

log('Wrapper starting...');

const child = spawn('./node_modules/.bin/next', ['start', '-p', '3000', '-H', '127.0.0.1'], {
  cwd: '/home/z/my-project',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

child.stdout.on('data', (data) => {
  log(`STDOUT: ${data.toString().trim()}`);
});

child.stderr.on('data', (data) => {
  log(`STDERR: ${data.toString().trim()}`);
});

child.on('exit', (code, signal) => {
  log(`EXIT: code=${code}, signal=${signal}`);
  // Restart after 2 seconds
  setTimeout(() => {
    log('Restarting...');
    process.exit(1); // Let the parent process handle restart
  }, 2000);
});

// Handle parent signals
['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'].forEach(sig => {
  process.on(sig, (signal) => {
    log(`PARENT SIGNAL: ${sig}`);
  });
});

// Keep alive
setInterval(() => {
  if (child.exitCode !== null) {
    log('Child dead, parent exiting to allow restart');
    process.exit(1);
  }
}, 1000);
