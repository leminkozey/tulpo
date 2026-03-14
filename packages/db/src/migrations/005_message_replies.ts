import type { Database } from "bun:sqlite";

export const migration005 = {
  name: "005_message_replies",
  up(db: Database) {
    db.run(
      `ALTER TABLE dm_messages ADD COLUMN reply_to_id TEXT REFERENCES dm_messages(id) ON DELETE SET NULL`
    );
  },
};
