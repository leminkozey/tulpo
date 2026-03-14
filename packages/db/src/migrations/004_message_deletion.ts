import type { Database } from "bun:sqlite";

export const migration004 = {
  name: "004_message_deletion",
  up(db: Database) {
    // Track "deleted for everyone" timestamp
    db.run(`ALTER TABLE dm_messages ADD COLUMN deleted_at TEXT`);

    // Track per-user "delete for me"
    db.run(`
      CREATE TABLE dm_message_deletions (
        dm_message_id TEXT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (dm_message_id, user_id)
      )
    `);
    db.run(
      `CREATE INDEX idx_dm_message_deletions_user ON dm_message_deletions(user_id)`
    );
  },
};
