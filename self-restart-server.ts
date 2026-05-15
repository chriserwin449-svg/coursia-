// Coursia Preview Server - Bun.serve with preloaded assets
// Designed to survive sandbox: ultra-lightweight, no file I/O during requests
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
  console.error("ERROR: index.html not found. Run 'bun run build' first.");
  process.exit(1);
}

// Preload all static files into memory
const cache = new Map<string, Buffer>();

function loadDir(dir: string, urlPrefix: string) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const url = urlPrefix + "/" + e.name;
      if (e.isDirectory()) loadDir(full, url);
      else {
        const data = tryRead(full);
        if (data) cache.set(url, data);
      }
    }
  } catch { /* skip missing dirs */ }
}

// Load static chunks (JS, CSS)
loadDir(path.join(BASE, ".next", "static", "chunks"), "/_next/static/chunks");
loadDir(path.join(BASE, ".next", "static", "media"), "/_next/static/media");
loadDir(path.join(BASE, ".next", "static", "css"), "/_next/static/css");

// Load public files (logo, favicon, avatars, etc.)
loadDir(path.join(BASE, "public"), "");

const HTML_CT = "text/html; charset=utf-8";
const CACHE_CTRL = "public, max-age=86400";

console.log("READY " + cache.size + " files");

Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req: Request) {
    const url = new URL(req.url);
    const p = decodeURIComponent(url.pathname);

    // Index page
    if (p === "/" || p === "") {
      return new Response(indexHtml, { headers: { "Content-Type": HTML_CT } });
    }

    // Image optimization proxy
    if (p === "/_next/image") {
      const imgUrl = decodeURIComponent(url.searchParams.get("url") || "");
      if (imgUrl.startsWith("/")) {
        const data = cache.get(imgUrl);
        if (data) return new Response(data, { headers: { "Content-Type": getMime(imgUrl), "Cache-Control": CACHE_CTRL } });
      }
      return new Response("Not Found", { status: 404 });
    }

    // API routes - return JSON stubs so the app doesn't crash
    if (p.startsWith("/api/")) {
      return Response.json({ error: "Preview mode" });
    }

    // Static files from cache
    const data = cache.get(p);
    if (data) {
      return new Response(data, { headers: { "Content-Type": getMime(p), "Cache-Control": CACHE_CTRL } });
    }

    // Try with/without trailing slash
    if (p.endsWith("/") && p.length > 1) {
      const alt = cache.get(p.slice(0, -1));
      if (alt) return new Response(alt, { headers: { "Content-Type": getMime(p.slice(0, -1)), "Cache-Control": CACHE_CTRL } });
    } else {
      const alt = cache.get(p + "/");
      if (alt) return new Response(alt, { headers: { "Content-Type": getMime(p), "Cache-Control": CACHE_CTRL } });
    }

    // SPA fallback - serve index.html for client-side routing
    return new Response(indexHtml, { headers: { "Content-Type": HTML_CT } });
  },
});
