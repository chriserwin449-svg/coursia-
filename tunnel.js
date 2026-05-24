const net = require("net");
const server = net.createServer((client) => {
  const proxy = net.createConnection(3000, "127.0.0.1", () => {
    client.pipe(proxy);
    proxy.pipe(client);
  });
  client.on("error", () => { try { proxy.destroy(); } catch(e){} });
  proxy.on("error", () => { try { client.destroy(); } catch(e){} });
});
server.listen(3000, "::1", 1, () => {
  process.stderr.write("TUNNEL_READY\n");
});
server.on("error", (e) => {
  process.stderr.write("TUNNEL_ERROR: " + e.message + "\n");
  setTimeout(() => process.exit(1), 1000);
});
