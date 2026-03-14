import type { Database } from "bun:sqlite";

export const migration002 = {
  name: "002_friends_social",
  up(db: Database) {
    // Add note column to friends table
    db.run(`ALTER TABLE friends ADD COLUMN note TEXT`);

    // User settings table
    db.run(`
      CREATE TABLE user_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        allow_friend_request_notes INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
  },
};
