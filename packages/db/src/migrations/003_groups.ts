import type { Database } from "bun:sqlite";

export const migration003 = {
  name: "003_groups",
  up(db: Database) {
    // Add group fields to dm_channels
    db.run(`ALTER TABLE dm_channels ADD COLUMN name TEXT`);
    db.run(`ALTER TABLE dm_channels ADD COLUMN description TEXT`);
    db.run(`ALTER TABLE dm_channels ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0`);
    db.run(`ALTER TABLE dm_channels ADD COLUMN owner_id TEXT REFERENCES users(id)`);

    // Add participant status (active, left, hidden)
    db.run(`ALTER TABLE dm_participants ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
    // Timestamp when user left (to limit visible message history)
    db.run(`ALTER TABLE dm_participants ADD COLUMN left_at TEXT`);
  },
};
