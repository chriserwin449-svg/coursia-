process.on('SIGTERM', (sig) => { console.error(`Got SIGTERM`); });
process.on('SIGINT', (sig) => { console.error(`Got SIGINT`); });
process.on('SIGHUP', (sig) => { console.error(`Got SIGHUP`); });
process.on('SIGUSR1', (sig) => { console.error(`Got SIGUSR1`); });
process.on('SIGUSR2', (sig) => { console.error(`Got SIGUSR2`); });

const { createServer } = require('http');
const { parse } = require('url');

// Simple static file server for the built app
const fs = require('fs');
const path = require('path');

const handler = require('./.next/server.js');

createServer(handler).listen(3000, () => {
  console.log('Server listening on :3000');
});
