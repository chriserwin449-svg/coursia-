// Coursia Preview Server - Bun.serve based (survives sandbox)
const path = await import("node:path");
const fs = await import("node:fs");

const PORT = 3000;
const HOST = "0.0.0.0";
const BASE = import.meta.dir;

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
  const dot = url.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME[url.slice(dot)] || "application/octet-stream";
}

// Pre-load all static files into memory
const cache = new Map<string, Uint8Array>();
let totalBytes = 0;

function loadDir(dir: string, urlPrefix: string) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const url = urlPrefix + "/" + entry.name;
      if (entry.isDirectory()) {
        loadDir(full, url);
      } else {
        const data = fs.readFileSync(full);
        cache.set(url, data);
        totalBytes += data.length;
      }
    }
  } catch {
    /* skip */
  }
}

// Load public/ (avatars, logo, favicon, etc.)
loadDir(path.join(BASE, "public"), "");

// Load .next/static/ (JS chunks, CSS, fonts, media)
loadDir(path.join(BASE, ".next", "static"), "/_next/static");

// Load pre-rendered index.html
const indexPath = path.join(BASE, ".next", "server", "app", "index.html");
let indexHtml: Uint8Array;
if (fs.existsSync(indexPath)) {
  indexHtml = fs.readFileSync(indexPath);
  cache.set("/", indexHtml);
  totalBytes += indexHtml.length;
  console.log(`✓ Loaded index.html (${(indexHtml.length / 1024).toFixed(0)} KB)`);
} else {
  // Fallback: generate a minimal HTML page
  indexHtml = new TextEncoder().encode(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coursia</title></head><body><div id="__next"><p>Build required. Run: bun run build</p></div></body></html>`);
  cache.set("/", indexHtml);
  console.warn("⚠ No index.html found. Run 'bun run build' first.");
}

console.log(`✓ Cache: ${cache.size} files, ${Math.round(totalBytes / 1024)} KB`);

// Handle _next/image proxy
function handleImageProxy(urlStr: string): Uint8Array | null {
  try {
    const url = new URL(urlStr, "http://localhost");
    const imgUrl = decodeURIComponent(url.searchParams.get("url") || "");
    if (imgUrl.startsWith("/")) {
      const found = cache.get(imgUrl);
      if (found) return found;
      const fullPath = path.join(BASE, "public", imgUrl);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }
  } catch {
    /* skip */
  }
  return null;
}

// API route handler - returns JSON responses for minimal functionality
function handleApiRoute(urlPath: string): Response | null {
  // Simple JSON responses for API routes so the app doesn't crash
  const apiRoutes: Record<string, () => Response> = {
    "/api/db-status": () =>
      Response.json({ status: "ok" }),
    "/api/ai-status": () =>
      Response.json({ available: false, message: "API not configured" }),
    "/api/auth/me": () =>
      Response.json({ user: null }),
    "/api/setup-db": () =>
      Response.json({ success: true }),
    "/api/subscription/status": () =>
      Response.json({ active: false, plan: "free" }),
    "/api/courses/paywall-status": () =>
      Response.json({ isPaywalled: false }),
    "/api/flames": () =>
      Response.json({ count: 0 }),
    "/api/badges": () =>
      Response.json({ badges: [] }),
    "/api/study-time": () =>
      Response.json({ totalMinutes: 0 }),
    "/api/courses": () =>
      Response.json({ courses: [] }),
    "/api/random-topic": () =>
      Response.json({ topic: "", lang: "fr" }),
  };

  for (const [route, handler] of Object.entries(apiRoutes)) {
    if (urlPath === route || urlPath.startsWith(route + "/")) {
      return handler();
    }
  }

  // Generic API response for unmatched routes
  if (urlPath.startsWith("/api/")) {
    return Response.json({ error: "Not available in preview mode" });
  }

  return null;
}

// Start Bun server
const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    // Route: /
    if (pathname === "/" || pathname === "") {
      return new Response(indexHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Route: /_next/image?...
    if (pathname === "/_next/image") {
      const imgData = handleImageProxy(url.toString());
      if (imgData) {
        const mime = getMime(url.pathname);
        return new Response(imgData, {
          headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
        });
      }
      return new Response("Not Found", { status: 404 });
    }

    // Route: API
    if (pathname.startsWith("/api/")) {
      const apiResp = handleApiRoute(pathname);
      if (apiResp) return apiResp;
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Route: Static cache
    let body = cache.get(pathname);
    if (!body) {
      // Try with/without trailing slash
      if (pathname.endsWith("/") && pathname.length > 1) {
        body = cache.get(pathname.slice(0, -1));
      } else {
        body = cache.get(pathname + "/");
      }
    }

    if (body) {
      return new Response(body, {
        headers: {
          "Content-Type": getMime(pathname),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Fallback to index.html for SPA routing
    return new Response(indexHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  },
});

console.log(`✓ Coursia preview running on ${HOST}:${PORT}`);
