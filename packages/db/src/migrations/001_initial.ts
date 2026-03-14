import type { Database } from "bun:sqlite";

export const migration001 = {
  name: "001_initial",
  up(db: Database) {
    db.run(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        status TEXT CHECK(status IN ('online', 'offline', 'idle', 'dnd')) DEFAULT 'offline',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    db.run(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ip_address TEXT,
        user_agent TEXT
      )
    `);
    db.run(
      "CREATE INDEX idx_sessions_token ON sessions(token)"
    );
    db.run(
      "CREATE INDEX idx_sessions_user_id ON sessions(user_id)"
    );
    db.run(
      "CREATE INDEX idx_sessions_expires ON sessions(expires_at)"
    );

    db.run(`
      CREATE TABLE servers (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        name TEXT NOT NULL,
        icon_url TEXT,
        owner_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    db.run(`
      CREATE TABLE members (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        nickname TEXT,
        joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(user_id, server_id)
      )
    `);
    db.run("CREATE INDEX idx_members_server ON members(server_id)");
    db.run("CREATE INDEX idx_members_user ON members(user_id)");

    db.run(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run("CREATE INDEX idx_categories_server ON categories(server_id)");

    db.run(`
      CREATE TABLE channels (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        topic TEXT,
        type TEXT NOT NULL CHECK(type IN ('text', 'voice')) DEFAULT 'text',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run("CREATE INDEX idx_channels_server ON channels(server_id)");

    db.run(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        edited_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run(
      "CREATE INDEX idx_messages_channel ON messages(channel_id, created_at)"
    );
    db.run("CREATE INDEX idx_messages_author ON messages(author_id)");

    db.run(`
      CREATE TABLE attachments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run("CREATE INDEX idx_attachments_message ON attachments(message_id)");

    db.run(`
      CREATE TABLE roles (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        permissions INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run("CREATE INDEX idx_roles_server ON roles(server_id)");

    db.run(`
      CREATE TABLE member_roles (
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (member_id, role_id)
      )
    `);

    db.run(`
      CREATE TABLE invites (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))),
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        creator_id TEXT NOT NULL REFERENCES users(id),
        code TEXT NOT NULL UNIQUE,
        max_uses INTEGER,
        uses INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run("CREATE INDEX idx_invites_code ON invites(code)");
    db.run("CREATE INDEX idx_invites_server ON invites(server_id)");

    db.run(`
      CREATE TABLE friends (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(user_id, friend_id)
      )
    `);
    db.run("CREATE INDEX idx_friends_user ON friends(user_id)");
    db.run("CREATE INDEX idx_friends_friend ON friends(friend_id)");

    db.run(`
      CREATE TABLE dm_channels (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);

    db.run(`
      CREATE TABLE dm_participants (
        dm_channel_id TEXT NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (dm_channel_id, user_id)
      )
    `);
    db.run(
      "CREATE INDEX idx_dm_participants_user ON dm_participants(user_id)"
    );

    db.run(`
      CREATE TABLE dm_messages (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
        dm_channel_id TEXT NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        edited_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    db.run(
      "CREATE INDEX idx_dm_messages_channel ON dm_messages(dm_channel_id, created_at)"
    );
  },
};
