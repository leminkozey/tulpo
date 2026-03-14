import type { Database } from "bun:sqlite";

export const migration007 = {
  name: "007_upload_security",
  up(db: Database) {
    // Track storage usage per user for upload quotas
    db.run(
      "ALTER TABLE users ADD COLUMN storage_used INTEGER NOT NULL DEFAULT 0"
    );
  },
};
