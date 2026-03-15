import { getDb } from "./index";
import { migration001 } from "./migrations/001_initial";
import { migration002 } from "./migrations/002_friends_social";
import { migration003 } from "./migrations/003_groups";
import { migration004 } from "./migrations/004_message_deletion";
import { migration005 } from "./migrations/005_message_replies";
import { migration006 } from "./migrations/006_dm_attachments";
import { migration007 } from "./migrations/007_upload_security";
import { migration008 } from "./migrations/008_reports";
import { migration009 } from "./migrations/009_blocks_mutes";
import { migration010 } from "./migrations/010_emoji_reactions";
import { migration011 } from "./migrations/011_fix_reports";
import { migration012 } from "./migrations/012_user_profiles";
import { migration013 } from "./migrations/013_voice_calls";

interface Migration {
  name: string;
  up: (db: ReturnType<typeof getDb>) => void;
}

const migrations: Migration[] = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012, migration013];

export function runMigrations() {
  const db = getDb();

  // Create migrations tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  // Get applied migrations
  const applied = new Set(
    db
      .query("SELECT name FROM migrations")
      .all()
      .map((row: any) => row.name)
  );

  // Run pending migrations
  let count = 0;
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    console.log(`Running migration: ${migration.name}`);
    db.transaction(() => {
      migration.up(db);
      db.run("INSERT INTO migrations (name) VALUES (?)", [migration.name]);
    })();
    count++;
  }

  if (count === 0) {
    console.log("No pending migrations.");
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
}

// Allow running as standalone script
if (import.meta.main) {
  runMigrations();
}
