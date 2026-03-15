import type { Database } from "bun:sqlite";

export const migration012 = {
  name: "012_user_profiles",
  up(db: Database) {
    // Add profile fields to users
    db.run(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`);
    db.run(`ALTER TABLE users ADD COLUMN pronouns TEXT DEFAULT ''`);
    db.run(`ALTER TABLE users ADD COLUMN banner_url TEXT`);
    db.run(
      `ALTER TABLE users ADD COLUMN avatar_type TEXT NOT NULL DEFAULT 'color' CHECK(avatar_type IN ('color', 'image', 'gif'))`
    );
    db.run(`ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#14b8a6'`);

    // User custom links
    db.run(`CREATE TABLE user_links (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`);
    db.run(`CREATE INDEX idx_user_links_user ON user_links(user_id)`);
  },
};
