import type { Database } from "bun:sqlite";

export const migration009 = {
  name: "009_blocks_mutes",
  up(db: Database) {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(user_id, blocked_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS user_mutes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        muted_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(user_id, muted_id)
      )
    `);
  },
};
