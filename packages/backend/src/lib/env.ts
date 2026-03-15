import { DEFAULT_PORT } from "@tulpo/shared";

const isProd = process.env.NODE_ENV === "production";
const sessionSecret =
  process.env.TULPO_SESSION_SECRET || "dev-secret-change-me";
const pepper = process.env.TULPO_PEPPER || "tulpo-default-pepper-change-me";

// Fail-fast in production if secrets are defaults
if (isProd && sessionSecret === "dev-secret-change-me") {
  console.error("FATAL: TULPO_SESSION_SECRET must be set in production");
  process.exit(1);
}
if (isProd && pepper === "tulpo-default-pepper-change-me") {
  console.error("FATAL: TULPO_PEPPER must be set in production");
  process.exit(1);
}

export const env = {
  port: Number(process.env.TULPO_PORT) || DEFAULT_PORT,
  dbPath: process.env.TULPO_DB_PATH || "./data/tulpo.db",
  sessionSecret,
  pepper,
  isProd,
  // ClamAV daemon host (e.g. "localhost:3310"). Null = skip scanning.
  clamavHost: process.env.TULPO_CLAMAV_HOST || null,
  // Per-user upload storage quota in bytes (default 500 MB)
  uploadQuotaBytes:
    (Number(process.env.TULPO_UPLOAD_QUOTA_MB) || 500) * 1024 * 1024,
  // GIPHY API key for GIF/Sticker search
  giphyApiKey: process.env.TULPO_GIPHY_KEY || null,
};
