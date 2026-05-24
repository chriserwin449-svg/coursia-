// IPv6 -> IPv4 Tunnel for Caddy proxy
// Caddy resolves "localhost" to ::1 (IPv6) but IPv6 doesn't work on this system
// This tunnels [::1]:3000 -> 127.0.0.1:3000 so the proxy can reach Next.js

import net from 'node:net';

const TUNNEL_PORT = 3000;
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = parseInt(process.env.NEXT_PORT || '3000', 10);

const server = net.createServer((client) => {
  const proxy = net.createConnection({ host: TARGET_HOST, port: TARGET_PORT }, () => {
    client.pipe(proxy);
    proxy.pipe(client);
  });
  client.on('error', () => { try { proxy.destroy(); } catch {} });
  proxy.on('error', () => { try { client.destroy(); } catch {} });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[tunnel] Port ${TUNNEL_PORT} already in use, retrying in 1s...`);
    setTimeout(() => server.listen(TUNNEL_PORT, '::1'), 1000);
  } else {
    console.error(`[tunnel] Error: ${err.message}`);
    process.exit(1);
  }
});

server.listen(TUNNEL_PORT, '::1', 1, () => {
  console.error(`[tunnel] Ready: [::1]:${TUNNEL_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});

// Keep alive
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
