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

  // Verify user is a participant
  const participant = db
    .query(
      "SELECT 1 FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id);

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  const before = c.req.query("before");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);

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
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(channelId, before, limit) as any[];
  } else {
    rows = db
      .query(
        `SELECT m.id, m.content, m.created_at, m.edited_at,
                u.id as author_id, u.username as author_username,
                u.display_name as author_display_name, u.avatar_url as author_avatar
         FROM dm_messages m
         JOIN users u ON m.author_id = u.id
         WHERE m.dm_channel_id = ?
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(channelId, limit) as any[];
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

  const db = getDb();

  // Verify user is a participant
  const participant = db
    .query(
      "SELECT 1 FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id);

  if (!participant) {
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

  // Send to other participant(s) via WS
  const participants = db
    .query(
      "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ?"
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

export { dms };
