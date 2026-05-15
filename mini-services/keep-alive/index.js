// Keep-alive wrapper for Next.js dev server
// This keeps the process alive even when the parent shell exits
const { spawn } = require("child_process");
const http = require("http");

function startNext() {
  const next = spawn("npx", ["next", "dev", "-p", "3000"], {
    cwd: "/home/z/my-project",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  next.stdout.on("data", (data) => process.stdout.write(data.toString()));
  next.stderr.on("data", (data) => process.stderr.write(data.toString()));

  next.on("close", (code) => {
    console.log(`[keep-alive] Next exited (${code}). Restarting in 2s...`);
    setTimeout(startNext, 2000);
  });

  return next;
}

const nextProc = startNext();

// Simple keep-alive HTTP server on 3001
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Coursia Keep-Alive OK");
});

server.listen(3001, () => {
  console.log("[keep-alive] Monitoring on port 3001");
});
