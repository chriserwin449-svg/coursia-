// Custom server: IPv6 tunnel + Next.js in a single process
// Caddy resolves "localhost" to ::1 but IPv6 doesn't work
// Next.js runs on 3001 (IPv4), tunnel forwards ::1:3000 -> 127.0.0.1:3001

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import net from 'node:net';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '127.0.0.1';
const nextPort = 3001;
const tunnelPort = 3000;

const app = next({ dev, hostname, port: nextPort });
const handle = app.getRequestHandler();

// Start IPv6 tunnel: ::1:3000 -> 127.0.0.1:3001
const tunnelServer = net.createServer((client) => {
  const proxy = net.createConnection({ host: hostname, port: nextPort }, () => {
    client.pipe(proxy);
    proxy.pipe(client);
  });
  client.on('error', () => { try { proxy.destroy(); } catch {} });
  proxy.on('error', () => { try { client.destroy(); } catch {} });
});

tunnelServer.on('error', (err) => {
  console.error(`[tunnel] Error: ${err.message}`);
});

await new Promise((resolve, reject) => {
  tunnelServer.listen(tunnelPort, '::1', 1, () => {
    console.log(`> IPv6 tunnel: [::1]:${tunnelPort} -> ${hostname}:${nextPort}`);
    resolve(undefined);
  });
  tunnelServer.on('error', reject);
});

// Prepare Next.js
await app.prepare();

// Start HTTP server for Next.js
const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url || '', true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('Error handling request:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

await new Promise((resolve) => {
  server.listen(nextPort, hostname, () => {
    console.log(`> Next.js ready on http://${hostname}:${nextPort}`);
    resolve(undefined);
  });
});

console.log('> Server ready! Caddy can now reach via localhost:3000');

process.on('SIGTERM', () => { server.close(); tunnelServer.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); tunnelServer.close(); process.exit(0); });

// Prevent process from exiting
setInterval(() => {}, 60000);
