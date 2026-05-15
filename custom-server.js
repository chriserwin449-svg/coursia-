const { createServer } = require('http');
const next = require('next');

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

let requestCount = 0;

app.prepare().then(() => {
  createServer((req, res) => {
    requestCount++;
    console.log(`[${requestCount}] ${req.method} ${req.url}`);
    handle(req, res);
  }).listen(3000, () => {
    console.log('> Ready on http://localhost:3000');
  });
});
