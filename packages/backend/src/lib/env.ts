import { DEFAULT_PORT } from "@tulpo/shared";

export const env = {
  port: Number(process.env.TULPO_PORT) || DEFAULT_PORT,
  dbPath: process.env.TULPO_DB_PATH || "./data/tulpo.db",
  sessionSecret: process.env.TULPO_SESSION_SECRET || "dev-secret-change-me",
  pepper: process.env.TULPO_PEPPER || "tulpo-default-pepper-change-me",
  isProd: process.env.NODE_ENV === "production",
};
