const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const LOG = "/home/z/my-project/dev.log";
const PORT = 3000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG, line);
}

let nextProcess = null;
let crashCount = 0;
const MAX_CRASH = 10;

function startNext() {
  log(`Starting Next.js (crash #${crashCount})...`);

  if (nextProcess) {
    try { nextProcess.kill("SIGTERM"); } catch {}
    nextProcess = null;
  }

  if (crashCount >= MAX_CRASH) {
    log("Too many crashes, giving up");
    return;
  }

  nextProcess = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: "/home/z/my-project",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  nextProcess.stdout.on("data", (data) => fs.appendFileSync(LOG, data.toString()));
  nextProcess.stderr.on("data", (data) => fs.appendFileSync(LOG, data.toString()));

  nextProcess.on("close", (code) => {
    crashCount++;
    log(`Next.js exited (code=${code}, crash=${crashCount}). Restarting in 1s...`);
    setTimeout(startNext, 1000);
  });

  nextProcess.on("error", (err) => {
    crashCount++;
    log(`Next.js error: ${err.message}`);
    setTimeout(startNext, 1000);
  });
}

// Start Next.js
startNext();

// Reset crash count after successful ping
let successPing = 0;
setInterval(() => {
  http.get(`http://localhost:${PORT}/api/db-status`, (res) => {
    let data = "";
    res.on("data", (chunk) => data += chunk);
    res.on("end", () => {
      successPing++;
      if (successPing === 3) {
        crashCount = 0;
      }
      if (successPing % 15 === 0) log(`Ping OK (#${successPing})`);
    });
  }).on("error", () => {
    // Don't log every failed ping to avoid spam
  });
}, 3000);

// Keep-alive server on 3001
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Coursia Alive");
});
server.listen(3001, () => log("Watchdog on 3001"));

log("=== Coursia Keep-Alive Started ===");

process.on("SIGTERM", () => log("SIGTERM"));
process.on("SIGHUP", () => log("SIGHUP"));
