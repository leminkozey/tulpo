import type { getDb } from "../index";

export const migration013 = {
  name: "013_voice_calls",
  up(db: ReturnType<typeof getDb>) {
    db.run(`
      CREATE TABLE IF NOT EXISTS voice_calls (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        dm_channel_id TEXT NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('ringing', 'active', 'ended')) DEFAULT 'ringing',
        started_by TEXT NOT NULL REFERENCES users(id),
        started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ended_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS voice_call_participants (
        call_id TEXT NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        left_at TEXT,
        is_muted INTEGER NOT NULL DEFAULT 0,
        is_deafened INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (call_id, user_id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_voice_calls_channel ON voice_calls(dm_channel_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status)`);
  },
};
