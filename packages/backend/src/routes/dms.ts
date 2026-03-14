import { Hono } from "hono";
import { getDb } from "@tulpo/db";
import type { PublicUser } from "@tulpo/shared";
import { authMiddleware } from "../middleware/auth";
import { sendToUser } from "../ws/handler";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

const dms = new Hono<AuthEnv>();

dms.use("/*", authMiddleware);

// Rate limiter: max 5 messages per 5 seconds per user
const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX = 5;
const messageTimes = new Map<string, number[]>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const times = messageTimes.get(userId) ?? [];
  const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  messageTimes.set(userId, recent);

  if (recent.length >= RATE_LIMIT_MAX) {
    const oldestInWindow = recent[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

// List all DM channels for the current user (for sidebar)
dms.get("/", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const channels = db
    .query(
      `SELECT dc.id, dc.name, dc.description, dc.is_group, dc.owner_id, dc.created_at,
              dp.status as my_status, dp.left_at
       FROM dm_channels dc
       JOIN dm_participants dp ON dc.id = dp.dm_channel_id
       WHERE dp.user_id = ? AND dp.status != 'deleted'
       ORDER BY dc.created_at DESC`
    )
    .all(user.id) as any[];

  // For each channel, get participants
  const result = channels.map((ch: any) => {
    const participants = db
      .query(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status
         FROM dm_participants dp
         JOIN users u ON dp.user_id = u.id
         WHERE dp.dm_channel_id = ? AND dp.user_id != ?`
      )
      .all(ch.id, user.id) as any[];

    return {
      id: ch.id,
      name: ch.name,
      description: ch.description,
      is_group: !!ch.is_group,
      owner_id: ch.owner_id,
      my_status: ch.my_status,
      left_at: ch.left_at,
      participants,
    };
  });

  return c.json(result);
});

// Create group DM
dms.post("/group", async (c) => {
  const user = c.get("user");
  const { name, description, user_ids } = await c.req.json();

  if (!name?.trim()) {
    return c.json({ error: "Group name required" }, 400);
  }

  if (!Array.isArray(user_ids) || user_ids.length < 1) {
    return c.json({ error: "At least one other user required" }, 400);
  }

  const db = getDb();

  const channel = db
    .query(
      `INSERT INTO dm_channels (name, description, is_group, owner_id)
       VALUES (?, ?, 1, ?)
       RETURNING id`
    )
    .get(name.trim(), description?.trim() || null, user.id) as any;

  // Add the creator
  db.run(
    "INSERT INTO dm_participants (dm_channel_id, user_id, status) VALUES (?, ?, 'active')",
    [channel.id, user.id]
  );

  // Add other users
  for (const uid of user_ids) {
    if (uid === user.id) continue;
    db.run(
      "INSERT INTO dm_participants (dm_channel_id, user_id, status) VALUES (?, ?, 'active')",
      [channel.id, uid]
    );
    // Notify via WS
    sendToUser(uid, "GROUP_CREATED", {
      channel_id: channel.id,
      name: name.trim(),
      created_by: user.username,
    });
  }

  return c.json({ channel_id: channel.id }, 201);
});

// Open or get existing DM channel with a user
dms.post("/open", async (c) => {
  const user = c.get("user");
  const { user_id } = await c.req.json();

  if (!user_id || user_id === user.id) {
    return c.json({ error: "Invalid user" }, 400);
  }

  const db = getDb();

  // Check if DM channel already exists between these two users
  const existing = db
    .query(
      `SELECT dp1.dm_channel_id as id
       FROM dm_participants dp1
       JOIN dm_participants dp2 ON dp1.dm_channel_id = dp2.dm_channel_id
       WHERE dp1.user_id = ? AND dp2.user_id = ?`
    )
    .get(user.id, user_id) as any;

  if (existing) {
    return c.json({ channel_id: existing.id });
  }

  // Create new DM channel
  const channel = db
    .query("INSERT INTO dm_channels DEFAULT VALUES RETURNING id")
    .get() as any;

  db.run("INSERT INTO dm_participants (dm_channel_id, user_id) VALUES (?, ?)", [
    channel.id,
    user.id,
  ]);
  db.run("INSERT INTO dm_participants (dm_channel_id, user_id) VALUES (?, ?)", [
    channel.id,
    user_id,
  ]);

  return c.json({ channel_id: channel.id }, 201);
});

// Get messages for a DM channel
dms.get("/:id/messages", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const db = getDb();

  // Verify user is a participant (active or left, not deleted)
  const participant = db
    .query(
      "SELECT status, left_at FROM dm_participants WHERE dm_channel_id = ? AND user_id = ? AND status != 'deleted'"
    )
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  const before = c.req.query("before");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  // If user left the group, only show messages up to left_at
  const cutoff = participant.left_at;

  let rows;
  if (before) {
    rows = db
      .query(
        `SELECT m.id, m.content, m.created_at, m.edited_at,
                u.id as author_id, u.username as author_username,
                u.display_name as author_display_name, u.avatar_url as author_avatar
         FROM dm_messages m
         JOIN users u ON m.author_id = u.id
         WHERE m.dm_channel_id = ? AND m.created_at < ?
         ${cutoff ? "AND m.created_at <= ?" : ""}
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(channelId, before, ...(cutoff ? [cutoff] : []), limit) as any[];
  } else {
    rows = db
      .query(
        `SELECT m.id, m.content, m.created_at, m.edited_at,
                u.id as author_id, u.username as author_username,
                u.display_name as author_display_name, u.avatar_url as author_avatar
         FROM dm_messages m
         JOIN users u ON m.author_id = u.id
         WHERE m.dm_channel_id = ?
         ${cutoff ? "AND m.created_at <= ?" : ""}
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(channelId, ...(cutoff ? [cutoff] : []), limit) as any[];
  }

  return c.json(rows.reverse());
});

// Send a message in a DM channel
dms.post("/:id/messages", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const { content } = await c.req.json();

  if (!content?.trim()) {
    return c.json({ error: "Message content required" }, 400);
  }

  // Rate limit check
  const rateCheck = checkRateLimit(user.id);
  if (!rateCheck.allowed) {
    const retryAfter = Math.ceil(rateCheck.retryAfterMs / 1000);
    return c.json({ error: "Too many messages", retry_after: retryAfter }, 429);
  }

  const db = getDb();

  // Verify user is an active participant
  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id) as any;

  if (!participant || participant.status !== "active") {
    return c.json({ error: "Not found" }, 404);
  }

  // Insert message
  const msg = db
    .query(
      `INSERT INTO dm_messages (dm_channel_id, author_id, content)
       VALUES (?, ?, ?)
       RETURNING id, created_at`
    )
    .get(channelId, user.id, content.trim()) as any;

  const message = {
    id: msg.id,
    content: content.trim(),
    created_at: msg.created_at,
    edited_at: null,
    author_id: user.id,
    author_username: user.username,
    author_display_name: user.display_name,
    author_avatar: user.avatar_url,
  };

  // Send to other active participant(s) via WS
  const participants = db
    .query(
      "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'"
    )
    .all(channelId, user.id) as any[];

  for (const p of participants) {
    sendToUser(p.user_id, "DM_MESSAGE", {
      channel_id: channelId,
      message,
    });
  }

  return c.json(message, 201);
});

// Hide a DM from sidebar (just hides, doesn't unfriend or leave)
dms.post("/:id/hide", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const db = getDb();

  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  db.run(
    "UPDATE dm_participants SET status = 'hidden' WHERE dm_channel_id = ? AND user_id = ?",
    [channelId, user.id]
  );

  return c.json({ ok: true });
});

// Leave a group DM (can still see history up to leave point)
dms.post("/:id/leave", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const db = getDb();

  const channel = db
    .query("SELECT is_group FROM dm_channels WHERE id = ?")
    .get(channelId) as any;

  if (!channel?.is_group) {
    return c.json({ error: "Can only leave group DMs" }, 400);
  }

  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id) as any;

  if (!participant || participant.status !== "active") {
    return c.json({ error: "Not found" }, 404);
  }

  db.run(
    `UPDATE dm_participants SET status = 'left', left_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE dm_channel_id = ? AND user_id = ?`,
    [channelId, user.id]
  );

  // Notify remaining members
  const remaining = db
    .query(
      "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'"
    )
    .all(channelId, user.id) as any[];

  for (const p of remaining) {
    sendToUser(p.user_id, "GROUP_MEMBER_LEFT", {
      channel_id: channelId,
      user_id: user.id,
      username: user.username,
    });
  }

  return c.json({ ok: true });
});

// Delete a DM from sidebar (removes completely from view)
dms.delete("/:id", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const db = getDb();

  db.run(
    "UPDATE dm_participants SET status = 'deleted' WHERE dm_channel_id = ? AND user_id = ?",
    [channelId, user.id]
  );

  return c.json({ ok: true });
});

export { dms };
