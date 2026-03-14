import { Database } from "bun:sqlite";
import { resolve, join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";

let db: Database | null = null;

// Resolve project root (3 levels up from packages/db/src/)
const PROJECT_ROOT = resolve(import.meta.dir, "..", "..", "..");

export function getDb(): Database {
  if (db) return db;

  const dbPath =
    process.env.TULPO_DB_PATH || join(PROJECT_ROOT, "data", "tulpo.db");
  const resolvedPath = resolve(dbPath);

  // Ensure data directory exists
  const dir = dirname(resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Performance & safety pragmas
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
