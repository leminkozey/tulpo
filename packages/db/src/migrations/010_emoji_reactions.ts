import type { Database } from "bun:sqlite";

export const migration010 = {
  name: "010_emoji_reactions",
  up(db: Database) {
    db.run(`
      CREATE TABLE IF NOT EXISTS dm_reactions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        message_id TEXT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(message_id, user_id, emoji)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_dm_reactions_message ON dm_reactions(message_id)`);
  },
};
