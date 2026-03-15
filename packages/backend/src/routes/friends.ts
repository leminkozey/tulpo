import { Hono } from "hono";
import { getDb } from "@tulpo/db";
import { sendFriendRequestSchema } from "@tulpo/shared";
import type { PublicUser } from "@tulpo/shared";
import { authMiddleware } from "../middleware/auth";
import { sendToUser } from "../ws/handler";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

const friends = new Hono<AuthEnv>();

friends.use("/*", authMiddleware);

// Send friend request
friends.post("/request", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = sendFriendRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { username, note } = parsed.data;
  const db = getDb();

  // Can't add yourself
  if (username === user.username) {
    return c.json({ error: "You cannot add yourself as a friend" }, 400);
  }

  // Find target user
  const target = db
    .query(
      "SELECT id, username, display_name, avatar_url, status FROM users WHERE username = ?"
    )
    .get(username) as PublicUser | null;

  if (!target) {
    return c.json({ error: "User not found" }, 404);
  }

  // Check if request already exists (in either direction)
  const existing = db
    .query(
      "SELECT id, status, user_id, friend_id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
    )
    .get(user.id, target.id, target.id, user.id) as any;

  if (existing) {
    if (existing.status === "accepted") {
      return c.json({ error: "You are already friends" }, 409);
    }
    if (existing.status === "blocked") {
      return c.json({ error: "This action is not allowed" }, 403);
    }
    if (existing.user_id === user.id) {
      return c.json({ error: "Friend request already sent" }, 409);
    }
    // They sent us a request — auto-accept
    db.run("UPDATE friends SET status = 'accepted' WHERE id = ?", [
      existing.id,
    ]);
    // Create reverse row for bidirectional lookup
    db.run(
      "INSERT INTO friends (user_id, friend_id, status, note) VALUES (?, ?, 'accepted', ?)",
      [user.id, target.id, note || null]
    );

    // Notify both users via WS
    sendToUser(target.id, "FRIEND_ACCEPTED", { user: pickPublic(user) });
    sendToUser(user.id, "FRIEND_ACCEPTED", { user: target });

    return c.json({ status: "accepted" }, 200);
  }

  // Check if target allows notes
  let finalNote = note || null;
  if (finalNote) {
    const settings = db
      .query("SELECT allow_friend_request_notes FROM user_settings WHERE user_id = ?")
      .get(target.id) as any;
    // Default is allowed (1) if no settings row exists
    if (settings && !settings.allow_friend_request_notes) {
      finalNote = null;
    }
  }

  // Create friend request
  const result = db
    .query(
      "INSERT INTO friends (user_id, friend_id, note) VALUES (?, ?, ?) RETURNING id, created_at"
    )
    .get(user.id, target.id, finalNote) as any;

  // Notify target via WS
  sendToUser(target.id, "FRIEND_REQUEST", {
    id: result.id,
    from: pickPublic(user),
    note: finalNote,
    created_at: result.created_at,
  });

  return c.json({ id: result.id, status: "pending" }, 201);
});

// Accept friend request
friends.post("/:id/accept", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");
  const db = getDb();

  const request = db
    .query(
      "SELECT id, user_id, friend_id, note FROM friends WHERE id = ? AND friend_id = ? AND status = 'pending'"
    )
    .get(requestId, user.id) as any;

  if (!request) {
    return c.json({ error: "Friend request not found" }, 404);
  }

  // Accept: update original row + create reverse row
  db.transaction(() => {
    db.run("UPDATE friends SET status = 'accepted' WHERE id = ?", [request.id]);
    db.run(
      "INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')",
      [user.id, request.user_id]
    );
  })();

  // Get sender info for WS notification
  const sender = db
    .query("SELECT id, username, display_name, avatar_url, status FROM users WHERE id = ?")
    .get(request.user_id) as PublicUser;

  sendToUser(request.user_id, "FRIEND_ACCEPTED", { user: pickPublic(user) });

  return c.json({ status: "accepted", user: sender });
});

// Reject / cancel friend request
friends.delete("/:id", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");
  const db = getDb();

  // Can delete if you're the sender (cancel) or receiver (reject)
  const request = db
    .query(
      "SELECT id, user_id, friend_id, status FROM friends WHERE id = ? AND (user_id = ? OR friend_id = ?)"
    )
    .get(requestId, user.id, user.id) as any;

  if (!request) {
    return c.json({ error: "Not found" }, 404);
  }

  if (request.status === "accepted") {
    // Remove friendship: delete both directions
    db.transaction(() => {
      db.run("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", [
        request.user_id, request.friend_id, request.friend_id, request.user_id,
      ]);
    })();

    const otherId = request.user_id === user.id ? request.friend_id : request.user_id;
    sendToUser(otherId, "FRIEND_REMOVED", { user_id: user.id });
  } else {
    db.run("DELETE FROM friends WHERE id = ?", [request.id]);

    // Notify other party
    const otherId = request.user_id === user.id ? request.friend_id : request.user_id;
    sendToUser(otherId, "FRIEND_REQUEST_CANCELLED", { user_id: user.id });
  }

  return c.body(null, 204);
});

// Get incoming friend requests
friends.get("/incoming", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const rows = db
    .query(
      `SELECT f.id, f.note, f.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
       FROM friends f
       JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    )
    .all(user.id) as any[];

  return c.json(
    rows.map((r) => ({
      id: r.id,
      from: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        status: r.status,
      },
      note: r.note,
      created_at: r.created_at,
    }))
  );
});

// Get outgoing friend requests
friends.get("/outgoing", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const rows = db
    .query(
      `SELECT f.id, f.note, f.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`
    )
    .all(user.id) as any[];

  return c.json(
    rows.map((r) => ({
      id: r.id,
      to: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        status: r.status,
      },
      note: r.note,
      created_at: r.created_at,
    }))
  );
});

// Get accepted friends list
friends.get("/", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const rows = db
    .query(
      `SELECT f.id, f.note, f.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ? AND f.status = 'accepted'
       ORDER BY u.username ASC`
    )
    .all(user.id) as any[];

  return c.json(
    rows.map((r) => ({
      id: r.id,
      user: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        status: r.status,
      },
      note: r.note,
      created_at: r.created_at,
    }))
  );
});

// Block a user
friends.post("/block/:userId", async (c) => {
  const user = c.get("user");
  const targetId = c.req.param("userId");
  const db = getDb();

  if (targetId === user.id) return c.json({ error: "Cannot block yourself" }, 400);

  // Check target exists
  const target = db.query("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) return c.json({ error: "User not found" }, 404);

  // Insert block (ignore if already blocked)
  db.run(
    "INSERT OR IGNORE INTO user_blocks (user_id, blocked_id) VALUES (?, ?)",
    [user.id, targetId]
  );

  // Also remove friendship if exists
  db.run(
    "DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
    [user.id, targetId, targetId, user.id]
  );

  sendToUser(targetId, "FRIEND_REMOVED", { user_id: user.id });

  return c.json({ ok: true });
});

// Unblock a user
friends.delete("/block/:userId", async (c) => {
  const user = c.get("user");
  const targetId = c.req.param("userId");
  const db = getDb();

  db.run(
    "DELETE FROM user_blocks WHERE user_id = ? AND blocked_id = ?",
    [user.id, targetId]
  );

  return c.json({ ok: true });
});

// Get blocked users
friends.get("/blocked", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const rows = db.query(
    `SELECT b.id, b.created_at,
            u.id as user_id, u.username, u.display_name, u.avatar_url
     FROM user_blocks b
     JOIN users u ON b.blocked_id = u.id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`
  ).all(user.id) as any[];

  return c.json(rows.map(r => ({
    id: r.id,
    user: { id: r.user_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
    created_at: r.created_at,
  })));
});

// Mute a user
friends.post("/mute/:userId", async (c) => {
  const user = c.get("user");
  const targetId = c.req.param("userId");
  const db = getDb();

  if (targetId === user.id) return c.json({ error: "Cannot mute yourself" }, 400);

  db.run(
    "INSERT OR IGNORE INTO user_mutes (user_id, muted_id) VALUES (?, ?)",
    [user.id, targetId]
  );

  return c.json({ ok: true });
});

// Unmute a user
friends.delete("/mute/:userId", async (c) => {
  const user = c.get("user");
  const targetId = c.req.param("userId");
  const db = getDb();

  db.run(
    "DELETE FROM user_mutes WHERE user_id = ? AND muted_id = ?",
    [user.id, targetId]
  );

  return c.json({ ok: true });
});

// Get muted users
friends.get("/muted", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const rows = db.query(
    "SELECT muted_id FROM user_mutes WHERE user_id = ?"
  ).all(user.id) as any[];

  return c.json(rows.map(r => r.muted_id));
});

// Report a user
friends.post("/report/:userId", async (c) => {
  const user = c.get("user");
  const targetId = c.req.param("userId");
  const db = getDb();

  if (targetId === user.id) return c.json({ error: "Cannot report yourself" }, 400);

  const target = db.query("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{ reason?: string }>();

  db.run(
    `INSERT INTO reports (reporter_id, dm_channel_id, message_id, type, reason)
     VALUES (?, '', ?, 'user', ?)`,
    [user.id, targetId, body.reason || ""]
  );

  return c.json({ ok: true });
});

function pickPublic(u: PublicUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    status: u.status,
  };
}

export { friends };
