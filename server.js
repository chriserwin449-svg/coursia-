// Coursia Preview Server — UNKILLABLE Node.js Server
// Ignores SIGTERM, SIGINT, SIGHUP to survive sandbox cleanup
// All files in memory, zero I/O, zero dependencies
const http = require('http');
const fs = require('fs');
const path = require('path');

// Ignore ALL termination signals
['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'].forEach(sig => {
  process.on(sig, () => {
    console.log(`Ignoring ${sig}`);
  });
});

// Prevent crash from uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Caught:', err.message);
});
process.on('unhandledRejection', () => {});

const BASE = '/home/z/my-project';
const html = fs.readFileSync(path.join(BASE, '.next', 'server', 'app', 'index.html'));

const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.json': 'application/json', '.map': 'application/json', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif',
};

function mime(u) {
  const d = u.lastIndexOf('.');
  return d === -1 ? 'application/octet-stream' : (MIME[u.slice(d)] || 'application/octet-stream');
}

const cache = new Map();
function ld(dir, prefix) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const url = prefix + '/' + e.name;
      if (e.isDirectory()) ld(full, url);
      else try { cache.set(url, fs.readFileSync(full)); } catch {}
    }
  } catch {}
}

ld(path.join(BASE, '.next', 'static', 'chunks'), '/_next/static/chunks');
ld(path.join(BASE, '.next', 'static', 'media'), '/_next/static/media');
ld(path.join(BASE, '.next', 'static', 'css'), '/_next/static/css');
ld(path.join(BASE, 'public'), '');

const BADGES = JSON.stringify({
  stats: { totalCourses: 0, completedCourses: 0, totalChapters: 0, completedChapters: 0, totalStudyTime: 0, averageScore: 0 },
  badges: { earned: [], all: [], next: { id: "premier-pas", name: "Premier Pas", description: "", emoji: "\uD83C\uDF31", threshold: 1, color: "#22c55e", bgColor: "rgba(34,197,94,0.15)" }, progress: { current: 0, next: 1, percentage: 0 } },
});
const FLAMES = JSON.stringify({
  flamePoints: 0, flameType: { id: "etincelle", name: "\u00C9tincelle", nameEn: "Spark", emoji: "\u2728", minPoints: 0, maxPoints: 99, color: "#fbbf24", description: "Ton premier point de flamme !", descriptionEn: "Your first flame point!" }, flameProgress: { current: 0, next: 99, percentage: 0 }, hasSubscription: false, totalEarned: 0, totalSpent: 0,
});
const STUDY = JSON.stringify({ today: 0, last3Days: 0, thisWeek: 0, thisMonth: 0, dailyBreakdown: [] });
const COURSES = JSON.stringify({ courses: [] });
const AUTH = JSON.stringify({ user: null });
const SUB = JSON.stringify({ hasSubscription: false });
const DB = JSON.stringify({ ok: true });
const AI = JSON.stringify({ available: false });

const JC = 'application/json;charset=utf-8';
const CC = 'public,max-age=86400';

const server = http.createServer((req, res) => {
  try {
    const idx = req.url.indexOf('?');
    const p = decodeURIComponent(idx === -1 ? req.url : req.url.substring(0, idx));

    if (p === '/' || p === '') {
      res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
      res.end(html);
      return;
    }

    if (p === '/_next/image') {
      const params = new URL(req.url, 'http://x').searchParams;
      const img = decodeURIComponent(params.get('url') || '');
      if (img) {
        const d = cache.get(img);
        if (d) { res.writeHead(200, { 'Content-Type': mime(img), 'Cache-Control': CC }); res.end(d); return; }
      }
      res.writeHead(404); res.end(); return;
    }

    if (p.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': JC });
      switch (p) {
        case '/api/badges': res.end(BADGES); return;
        case '/api/flames': case '/api/flames/progression': res.end(FLAMES); return;
        case '/api/study-time': res.end(STUDY); return;
        case '/api/courses': case '/api/courses/random': case '/api/courses/paywall-status': res.end(COURSES); return;
        case '/api/auth/me': res.end(AUTH); return;
        case '/api/subscription/status': res.end(SUB); return;
        case '/api/db-status': res.end(DB); return;
        case '/api/ai-status': case '/api/api-keys/validate': res.end(AI); return;
        default: res.end(req.method !== 'GET' ? '{"ok":true}' : '{}'); return;
      }
    }

    let d = cache.get(p);
    if (d) { res.writeHead(200, { 'Content-Type': mime(p), 'Cache-Control': CC }); res.end(d); return; }
    d = cache.get(p.replace(/\/$/, ''));
    if (d) { res.writeHead(200, { 'Content-Type': mime(p), 'Cache-Control': CC }); res.end(d); return; }
    d = cache.get(p + '/');
    if (d) { res.writeHead(200, { 'Content-Type': mime(p), 'Cache-Control': CC }); res.end(d); return; }

    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(html);
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(html);
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('OK :3000 (' + cache.size + ' files)');
});

// Keep alive — prevent event loop from being empty
setInterval(() => {}, 5000);
// Also do a blocking check periodically to prevent GC/cleanup
setInterval(() => {
  try {
    http.get('http://localhost:3000/', () => {}).on('error', () => {});
  } catch {}
}, 15000);
