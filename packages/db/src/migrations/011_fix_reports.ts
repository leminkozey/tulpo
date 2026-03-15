import type { Database } from "bun:sqlite";

export const migration011 = {
  name: "011_fix_reports",
  up(db: Database) {
    // Recreate reports table with correct schema:
    // - Add reported_user_id column
    // - Make dm_channel_id and message_id nullable
    // - Add 'user' to type CHECK constraint
    db.run(`CREATE TABLE IF NOT EXISTS reports_new (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
      reporter_id TEXT NOT NULL REFERENCES users(id),
      reported_user_id TEXT REFERENCES users(id),
      dm_channel_id TEXT REFERENCES dm_channels(id),
      message_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('message', 'file', 'user')),
      filename TEXT,
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`);

    db.run(`INSERT OR IGNORE INTO reports_new (id, reporter_id, dm_channel_id, message_id, type, filename, reason, status, created_at)
      SELECT id, reporter_id, dm_channel_id, message_id,
        CASE WHEN type NOT IN ('message', 'file', 'user') THEN 'message' ELSE type END,
        filename, reason, status, created_at
      FROM reports`);

    db.run(`DROP TABLE reports`);
    db.run(`ALTER TABLE reports_new RENAME TO reports`);
  },
};
