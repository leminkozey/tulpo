import { DEFAULT_PORT } from "@tulpo/shared";

export const env = {
  port: Number(process.env.TULPO_PORT) || DEFAULT_PORT,
  dbPath: process.env.TULPO_DB_PATH || "./data/tulpo.db",
  sessionSecret: process.env.TULPO_SESSION_SECRET || "dev-secret-change-me",
  pepper: process.env.TULPO_PEPPER || "tulpo-default-pepper-change-me",
  isProd: process.env.NODE_ENV === "production",
  // ClamAV daemon host (e.g. "localhost:3310"). Null = skip scanning.
  clamavHost: process.env.TULPO_CLAMAV_HOST || null,
  // Per-user upload storage quota in bytes (default 500 MB)
  uploadQuotaBytes:
    (Number(process.env.TULPO_UPLOAD_QUOTA_MB) || 500) * 1024 * 1024,
};
