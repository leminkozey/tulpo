import { getDb } from "./index";
import { migration001 } from "./migrations/001_initial";

interface Migration {
  name: string;
  up: (db: ReturnType<typeof getDb>) => void;
}

const migrations: Migration[] = [migration001];

function runMigrations() {
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

runMigrations();
