/**
 * Keep-alive service — pings the Next.js dev server every 4 seconds
 * to prevent sandbox from killing the process due to inactivity.
 */

const NEXTJS_URL = process.env.NEXTJS_URL || "http://127.0.0.1:3000";
const PING_INTERVAL_MS = 4000;

let successCount = 0;
let failCount = 0;

async function ping() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(NEXTJS_URL, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (res.ok) {
      successCount++;
      failCount = 0;
      if (successCount % 30 === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Alive — ${successCount} pings OK`);
      }
    } else {
      failCount++;
      console.error(`[${new Date().toLocaleTimeString()}] ⚠️ HTTP ${res.status}`);
    }
  } catch (err) {
    failCount++;
    const msg = err instanceof Error ? err.message : String(err);
    if (failCount <= 3) {
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Ping failed: ${msg}`);
    } else if (failCount % 15 === 0) {
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Still failing (${failCount} consecutive)`);
    }
  }
}

// Start pinging
console.log(`🚀 Keep-alive started — pinging ${NEXTJS_URL} every ${PING_INTERVAL_MS / 1000}s`);

// Initial delay to let Next.js start
setTimeout(() => {
  ping();
  setInterval(ping, PING_INTERVAL_MS);
}, 3000);
