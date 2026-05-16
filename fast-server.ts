// Coursia Fast Preview Server - Bun.serve with preloaded assets
// Survives sandbox by being ultra-lightweight
const fs = require("fs");
const path = require("path");

const BASE = "/home/z/my-project";
const PORT = 3000;
const HOST = "0.0.0.0";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain",
  ".map": "application/json",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function getMime(url: string): string {
  const d = url.lastIndexOf(".");
  return d === -1 ? "application/octet-stream" : (MIME[url.slice(d)] || "application/octet-stream");
}

function tryRead(p: string): Buffer | null {
  try { return fs.readFileSync(p); } catch { return null; }
}

// Preload index.html
const indexPath = path.join(BASE, ".next", "server", "app", "index.html");
const indexHtml = tryRead(indexPath);

if (!indexHtml) {
  console.error("ERROR: No index.html found. Run 'bun run build' first.");
  process.exit(1);
}

// Preload static chunks
const staticCache = new Map<string, Buffer>();
const chunksDir = path.join(BASE, ".next", "static", "chunks");
try {
  for (const f of fs.readdirSync(chunksDir)) {
    if (!f.endsWith(".map")) {
      staticCache.set("/_next/static/chunks/" + f, tryRead(path.join(chunksDir, f))!);
    }
  }
} catch {}

// Preload media
const mediaDir = path.join(BASE, ".next", "static", "media");
try {
  for (const f of fs.readdirSync(mediaDir)) {
    staticCache.set("/_next/static/media/" + f, tryRead(path.join(mediaDir, f))!);
  }
} catch {}

// Preload CSS
const cssDir = path.join(BASE, ".next", "static", "css");
try {
  for (const f of fs.readdirSync(cssDir)) {
    staticCache.set("/_next/static/css/" + f, tryRead(path.join(cssDir, f))!);
  }
} catch {}

// Preload public files
const pubCache = new Map<string, Buffer>();
function loadPublic(dir: string, prefix: string) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const url = prefix + "/" + e.name;
      if (e.isDirectory()) loadPublic(full, url);
      else pubCache.set(url, tryRead(full)!);
    }
  } catch {}
}
loadPublic(path.join(BASE, "public"), "");

console.log(`READY - ${staticCache.size} chunks, ${pubCache.size} public files`);

// API responses
function handleApi(pathname: string): Response | null {
  const json: Record<string, unknown> = {
    "/api/db-status": { status: "ok" },
    "/api/ai-status": { available: false },
    "/api/auth/me": { user: null },
    "/api/setup-db": { success: true },
    "/api/subscription/status": { active: false, plan: "free" },
    "/api/courses/paywall-status": { isPaywalled: false },
    "/api/flames": { count: 0 },
    "/api/badges": { badges: [] },
    "/api/study-time": { totalMinutes: 0 },
    "/api/courses": { courses: [] },
  };
  for (const [route, data] of Object.entries(json)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return Response.json(data);
    }
  }
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Preview mode" });
  }
  return null;
}

const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" };
const STATIC_HEADERS = { "Cache-Control": "public, max-age=86400" };

Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req: Request) {
    const url = new URL(req.url);
    const p = decodeURIComponent(url.pathname);

    // Index
    if (p === "/" || p === "") {
      return new Response(indexHtml, { headers: HTML_HEADERS });
    }

    // API
    if (p.startsWith("/api/")) {
      return handleApi(p) || Response.json({ error: "Not found" }, { status: 404 });
    }

    // Image proxy
    if (p === "/_next/image") {
      const imgUrl = decodeURIComponent(url.searchParams.get("url") || "");
      if (imgUrl.startsWith("/")) {
        const d = pubCache.get(imgUrl);
        if (d) return new Response(d, { headers: { "Content-Type": getMime(imgUrl), ...STATIC_HEADERS } });
      }
      return new Response("Not Found", { status: 404 });
    }

    // Static chunks
    let d = staticCache.get(p);
    if (d) return new Response(d, { headers: { "Content-Type": getMime(p), ...STATIC_HEADERS } });

    // Public files
    d = pubCache.get(p);
    if (d) return new Response(d, { headers: { "Content-Type": getMime(p), ...STATIC_HEADERS } });

    // SPA fallback
    return new Response(indexHtml, { headers: HTML_HEADERS });
  },
});
