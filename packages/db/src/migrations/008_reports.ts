import type { Database } from "bun:sqlite";

export const migration008 = {
  name: "008_reports",
  up(db: Database) {
    db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        reporter_id TEXT NOT NULL REFERENCES users(id),
        dm_channel_id TEXT NOT NULL REFERENCES dm_channels(id),
        message_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('message', 'file')),
        filename TEXT,
        reason TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'dismissed')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
  },
};
