import type { Database } from "bun:sqlite";

export const migration006 = {
  name: "006_dm_attachments",
  up(db: Database) {
    db.run(`
      CREATE TABLE dm_attachments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        dm_message_id TEXT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    db.run(`CREATE INDEX idx_dm_attachments_message ON dm_attachments(dm_message_id)`);
  },
};
