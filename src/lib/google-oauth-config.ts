/**
 * Loads Google OAuth credentials from google-oauth.json at project root.
 * This file is NOT committed to git — it contains secrets.
 * Falls back to process.env if the file is missing.
 */
function loadConfig() {
  try {
    const fs = require("fs");
    const path = require("path");
    const configPath = path.join(process.cwd(), "google-oauth.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    return {
      clientId: config.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: config.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    };
  } catch {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    };
  }
}

const _c = loadConfig();

export function getGoogleOAuthCredentials() {
  return _c;
}
