import { Hono } from "hono";
import { getDb } from "@tulpo/db";
import type { PublicUser } from "@tulpo/shared";
import { ALLOWED_MIME_TYPES, MAX_IMAGE_SIZE, MAX_FILE_SIZE } from "@tulpo/shared";
import { authMiddleware } from "../middleware/auth";
import { sendToUser } from "../ws/handler";
import { signUrl } from "../lib/signed-url";
import { env } from "../lib/env";
import {
  verifyMagicBytes,
  checkFileSafety,
  processImage,
  scanWithClamAV,
  checkUploadRateLimit,
} from "../lib/upload";
import { join } from "path";
import { mkdir } from "fs/promises";

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

  const baseSelect = `SELECT m.id, m.content, m.created_at, m.edited_at,
                u.id as author_id, u.username as author_username,
                u.display_name as author_display_name, u.avatar_url as author_avatar,
                m.reply_to_id,
                CASE WHEN rm.deleted_at IS NOT NULL THEN NULL ELSE rm.content END as reply_to_content,
                ru.username as reply_to_author_username,
                ru.display_name as reply_to_author_display_name
         FROM dm_messages m
         JOIN users u ON m.author_id = u.id
         LEFT JOIN dm_message_deletions dmd ON m.id = dmd.dm_message_id AND dmd.user_id = ?
         LEFT JOIN dm_messages rm ON m.reply_to_id = rm.id
         LEFT JOIN users ru ON rm.author_id = ru.id`;

  let rows;
  if (before) {
    rows = db
      .query(
        `${baseSelect}
         WHERE m.dm_channel_id = ? AND m.created_at < ? AND dmd.dm_message_id IS NULL
         ${cutoff ? "AND m.created_at <= ?" : ""}
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(user.id, channelId, before, ...(cutoff ? [cutoff] : []), limit) as any[];
  } else {
    rows = db
      .query(
        `${baseSelect}
         WHERE m.dm_channel_id = ? AND dmd.dm_message_id IS NULL
         ${cutoff ? "AND m.created_at <= ?" : ""}
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(user.id, channelId, ...(cutoff ? [cutoff] : []), limit) as any[];
  }

  const messages = rows.reverse();

  // Batch-fetch attachments for all messages
  if (messages.length > 0) {
    const messageIds = messages.map((m: any) => m.id);
    const placeholders = messageIds.map(() => "?").join(",");
    const attachments = db
      .query(
        `SELECT id, dm_message_id, filename, mime_type, size, url
         FROM dm_attachments WHERE dm_message_id IN (${placeholders})`
      )
      .all(...messageIds) as any[];

    const attachmentMap = new Map<string, any[]>();
    for (const att of attachments) {
      if (!attachmentMap.has(att.dm_message_id)) {
        attachmentMap.set(att.dm_message_id, []);
      }
      attachmentMap.get(att.dm_message_id)!.push({
        id: att.id,
        filename: att.filename,
        mime_type: att.mime_type,
        size: att.size,
        url: signUrl(att.url),
      });
    }

    for (const msg of messages) {
      (msg as any).attachments = attachmentMap.get(msg.id) || [];
    }
  }

  return c.json(messages);
});

// Send a message in a DM channel (JSON or multipart with file)
dms.post("/:id/messages", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");

  let content: string | null = null;
  let reply_to_id: string | null = null;
  let file: File | null = null;

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    content = (body["content"] as string) || null;
    reply_to_id = (body["reply_to_id"] as string) || null;
    const uploaded = body["file"];
    if (uploaded instanceof File) {
      file = uploaded;
    }
  } else {
    const json = await c.req.json();
    content = json.content || null;
    reply_to_id = json.reply_to_id || null;
  }

  // Must have content or file
  if (!content?.trim() && !file) {
    return c.json({ error: "Message content or file required" }, 400);
  }

  // Validate file if present
  let fileBuffer: Buffer | null = null;
  if (file) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return c.json({ error: "File type not allowed" }, 400);
    }
    const maxSize = file.type.startsWith("image/") ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / 1024 / 1024);
      return c.json({ error: `File too large (max ${maxMB} MB)` }, 400);
    }

    // Read file into buffer for all checks
    fileBuffer = Buffer.from(await file.arrayBuffer());

    // Verify actual file content via magic bytes
    const header = new Uint8Array(fileBuffer.slice(0, 12));
    if (!verifyMagicBytes(header, file.type)) {
      return c.json({ error: "File content doesn't match declared type" }, 400);
    }

    // Polyglot / content safety checks
    const safety = checkFileSafety(new Uint8Array(fileBuffer), file.type);
    if (!safety.safe) {
      return c.json({ error: safety.reason || "File rejected" }, 400);
    }

    // ClamAV virus scan (if configured, fail-closed)
    const scan = await scanWithClamAV(new Uint8Array(fileBuffer));
    if (!scan.clean) {
      console.warn(`Virus detected in upload from ${user.id}: ${scan.virus}`);
      return c.json({ error: "File rejected by virus scanner" }, 400);
    }

    // Re-encode images (strip metadata, limit dimensions)
    if (file.type.startsWith("image/")) {
      try {
        fileBuffer = await processImage(fileBuffer, file.type);
      } catch (err) {
        console.warn("Image processing failed:", err);
        return c.json({ error: "Invalid or corrupted image" }, 400);
      }
    }

    // Upload rate limit
    const uploadRate = checkUploadRateLimit(user.id);
    if (!uploadRate.allowed) {
      const retryMin = Math.ceil(uploadRate.retryAfterMs / 60_000);
      return c.json({ error: `Upload limit reached, try again in ${retryMin} min` }, 429);
    }
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

  // Validate reply_to_id if provided
  let replyData: any = null;
  if (reply_to_id) {
    const replyMsg = db
      .query(
        `SELECT m.id, m.content, m.deleted_at, u.username, u.display_name
         FROM dm_messages m JOIN users u ON m.author_id = u.id
         WHERE m.id = ? AND m.dm_channel_id = ?`
      )
      .get(reply_to_id, channelId) as any;

    if (replyMsg) {
      replyData = {
        reply_to_id: replyMsg.id,
        reply_to_content: replyMsg.deleted_at ? null : replyMsg.content,
        reply_to_author_username: replyMsg.username,
        reply_to_author_display_name: replyMsg.display_name,
      };
    }
  }

  // Insert message
  const msg = db
    .query(
      `INSERT INTO dm_messages (dm_channel_id, author_id, content, reply_to_id)
       VALUES (?, ?, ?, ?)
       RETURNING id, created_at`
    )
    .get(channelId, user.id, content?.trim() || "", reply_to_id || null) as any;

  // Handle file upload
  let attachments: any[] = [];
  if (file && fileBuffer) {
    const finalSize = fileBuffer.length;

    // Check storage quota
    const userRow = db
      .query("SELECT storage_used FROM users WHERE id = ?")
      .get(user.id) as any;
    const storageUsed = userRow?.storage_used ?? 0;
    if (storageUsed + finalSize > env.uploadQuotaBytes) {
      const usedMB = Math.round(storageUsed / 1024 / 1024);
      const quotaMB = Math.round(env.uploadQuotaBytes / 1024 / 1024);
      return c.json(
        { error: `Storage quota exceeded (${usedMB}/${quotaMB} MB used)` },
        413
      );
    }

    const uploadDir = join("data", "uploads", "dm", channelId);
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop() || "bin";
    const storedFilename = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filePath = join(uploadDir, storedFilename);
    const rawUrl = `/uploads/dm/${channelId}/${storedFilename}`;

    // Write processed buffer (re-encoded for images, original for others)
    await Bun.write(filePath, fileBuffer);

    // Update user storage usage
    db.run("UPDATE users SET storage_used = storage_used + ? WHERE id = ?", [
      finalSize,
      user.id,
    ]);

    const att = db
      .query(
        `INSERT INTO dm_attachments (dm_message_id, filename, stored_filename, mime_type, size, url)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id`
      )
      .get(msg.id, file.name, storedFilename, file.type, finalSize, rawUrl) as any;

    attachments = [{
      id: att.id,
      filename: file.name,
      mime_type: file.type,
      size: finalSize,
      url: signUrl(rawUrl),
    }];
  }

  const message = {
    id: msg.id,
    content: content?.trim() || "",
    created_at: msg.created_at,
    edited_at: null,
    author_id: user.id,
    author_username: user.username,
    author_display_name: user.display_name,
    author_avatar: user.avatar_url,
    reply_to_id: replyData?.reply_to_id || null,
    reply_to_content: replyData?.reply_to_content || null,
    reply_to_author_username: replyData?.reply_to_author_username || null,
    reply_to_author_display_name: replyData?.reply_to_author_display_name || null,
    attachments,
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

// Unhide a DM (restore to sidebar)
dms.post("/:id/unhide", async (c) => {
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

  if (participant.status === "hidden") {
    db.run(
      "UPDATE dm_participants SET status = 'active' WHERE dm_channel_id = ? AND user_id = ?",
      [channelId, user.id]
    );
  }

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

  // System message
  const sysMsg = db
    .query(
      `INSERT INTO dm_messages (dm_channel_id, author_id, content)
       VALUES (?, ?, ?)
       RETURNING id, created_at`
    )
    .get(channelId, user.id, `[system] ${user.username} left the group`) as any;

  const message = {
    id: sysMsg.id,
    content: `[system] ${user.username} left the group`,
    created_at: sysMsg.created_at,
    edited_at: null,
    author_id: user.id,
    author_username: user.username,
    author_display_name: user.display_name,
    author_avatar: user.avatar_url,
    is_system: true,
  };

  // Notify remaining members
  const remaining = db
    .query(
      "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'"
    )
    .all(channelId, user.id) as any[];

  for (const p of remaining) {
    sendToUser(p.user_id, "DM_MESSAGE", { channel_id: channelId, message });
    sendToUser(p.user_id, "GROUP_MEMBER_LEFT", {
      channel_id: channelId,
      user_id: user.id,
      username: user.username,
    });
  }

  return c.json({ ok: true });
});

// Update group DM (name, description)
dms.patch("/:id", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const { name, description } = await c.req.json();
  const db = getDb();

  const channel = db
    .query("SELECT is_group, owner_id FROM dm_channels WHERE id = ?")
    .get(channelId) as any;

  if (!channel?.is_group) {
    return c.json({ error: "Can only edit group DMs" }, 400);
  }

  // Any active participant can edit
  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ? AND status = 'active'"
    )
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  if (name !== undefined) {
    db.run("UPDATE dm_channels SET name = ? WHERE id = ?", [
      name?.trim() || null,
      channelId,
    ]);
  }
  if (description !== undefined) {
    db.run("UPDATE dm_channels SET description = ? WHERE id = ?", [
      description?.trim() || null,
      channelId,
    ]);
  }

  // Notify all active participants
  const participants = db
    .query(
      "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'"
    )
    .all(channelId, user.id) as any[];

  for (const p of participants) {
    sendToUser(p.user_id, "GROUP_UPDATED", {
      channel_id: channelId,
      name: name?.trim(),
      description: description?.trim(),
      updated_by: user.username,
    });
  }

  return c.json({ ok: true });
});

// Add members to group DM
dms.post("/:id/members", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const { user_ids } = await c.req.json();
  const db = getDb();

  const channel = db
    .query("SELECT is_group, name FROM dm_channels WHERE id = ?")
    .get(channelId) as any;

  if (!channel?.is_group) {
    return c.json({ error: "Can only add members to group DMs" }, 400);
  }

  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ? AND status = 'active'"
    )
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  if (!Array.isArray(user_ids) || user_ids.length < 1) {
    return c.json({ error: "user_ids required" }, 400);
  }

  const added: string[] = [];
  for (const uid of user_ids) {
    // Check if already participant
    const existing = db
      .query(
        "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
      )
      .get(channelId, uid) as any;

    if (existing) {
      if (existing.status !== "active") {
        db.run(
          "UPDATE dm_participants SET status = 'active', left_at = NULL WHERE dm_channel_id = ? AND user_id = ?",
          [channelId, uid]
        );
        added.push(uid);
      }
    } else {
      db.run(
        "INSERT INTO dm_participants (dm_channel_id, user_id, status) VALUES (?, ?, 'active')",
        [channelId, uid]
      );
      added.push(uid);
    }
  }

  // Insert system message
  for (const uid of added) {
    const addedUser = db
      .query("SELECT username FROM users WHERE id = ?")
      .get(uid) as any;

    const sysMsg = db
      .query(
        `INSERT INTO dm_messages (dm_channel_id, author_id, content)
         VALUES (?, ?, ?)
         RETURNING id, created_at`
      )
      .get(
        channelId,
        user.id,
        `[system] ${user.username} added ${addedUser?.username ?? "someone"} to the group`
      ) as any;

    const message = {
      id: sysMsg.id,
      content: `[system] ${user.username} added ${addedUser?.username ?? "someone"} to the group`,
      created_at: sysMsg.created_at,
      edited_at: null,
      author_id: user.id,
      author_username: user.username,
      author_display_name: user.display_name,
      author_avatar: user.avatar_url,
      is_system: true,
    };

    // Notify all active participants
    const allActive = db
      .query(
        "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND status = 'active'"
      )
      .all(channelId) as any[];

    for (const p of allActive) {
      if (p.user_id === user.id) continue;
      sendToUser(p.user_id, "DM_MESSAGE", { channel_id: channelId, message });
    }

    // Notify added user about the group
    sendToUser(uid, "GROUP_CREATED", {
      channel_id: channelId,
      name: channel.name,
      created_by: user.username,
    });
  }

  return c.json({ added }, 201);
});

// Kick member from group DM
dms.delete("/:id/members/:userId", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const db = getDb();

  const channel = db
    .query("SELECT is_group, owner_id FROM dm_channels WHERE id = ?")
    .get(channelId) as any;

  if (!channel?.is_group) {
    return c.json({ error: "Can only kick from group DMs" }, 400);
  }

  // Only owner can kick
  if (channel.owner_id !== user.id) {
    return c.json({ error: "Only the group owner can kick members" }, 403);
  }

  if (targetUserId === user.id) {
    return c.json({ error: "Cannot kick yourself" }, 400);
  }

  const target = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, targetUserId) as any;

  if (!target || target.status !== "active") {
    return c.json({ error: "User not in group" }, 404);
  }

  db.run(
    `UPDATE dm_participants SET status = 'left', left_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE dm_channel_id = ? AND user_id = ?`,
    [channelId, targetUserId]
  );

  const kickedUser = db
    .query("SELECT username FROM users WHERE id = ?")
    .get(targetUserId) as any;

  // System message
  const sysMsg = db
    .query(
      `INSERT INTO dm_messages (dm_channel_id, author_id, content)
       VALUES (?, ?, ?)
       RETURNING id, created_at`
    )
    .get(
      channelId,
      user.id,
      `[system] ${user.username} removed ${kickedUser?.username ?? "someone"} from the group`
    ) as any;

  const message = {
    id: sysMsg.id,
    content: `[system] ${user.username} removed ${kickedUser?.username ?? "someone"} from the group`,
    created_at: sysMsg.created_at,
    edited_at: null,
    author_id: user.id,
    author_username: user.username,
    author_display_name: user.display_name,
    author_avatar: user.avatar_url,
    is_system: true,
  };

  // Notify remaining
  const remaining = db
    .query(
      "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND status = 'active'"
    )
    .all(channelId) as any[];

  for (const p of remaining) {
    sendToUser(p.user_id, "DM_MESSAGE", { channel_id: channelId, message });
  }

  // Notify kicked user
  sendToUser(targetUserId, "GROUP_KICKED", {
    channel_id: channelId,
    kicked_by: user.username,
  });

  return c.json({ ok: true });
});

// Get group info (participants etc.)
dms.get("/:id/info", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const db = getDb();

  const channel = db
    .query("SELECT id, name, description, is_group, owner_id FROM dm_channels WHERE id = ?")
    .get(channelId) as any;

  if (!channel) {
    return c.json({ error: "Not found" }, 404);
  }

  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  const participants = db
    .query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, dp.status as member_status
       FROM dm_participants dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.dm_channel_id = ?`
    )
    .all(channelId) as any[];

  return c.json({
    ...channel,
    is_group: !!channel.is_group,
    participants,
  });
});

// Edit a message (own messages, < 20 min)
dms.patch("/:id/messages/:messageId", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const messageId = c.req.param("messageId");
  const { content } = await c.req.json();
  const db = getDb();

  if (!content?.trim()) {
    return c.json({ error: "Message content required" }, 400);
  }

  const participant = db
    .query("SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?")
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  const msg = db
    .query("SELECT id, author_id, content, created_at, deleted_at FROM dm_messages WHERE id = ? AND dm_channel_id = ?")
    .get(messageId, channelId) as any;

  if (!msg) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (msg.author_id !== user.id) {
    return c.json({ error: "Can only edit own messages" }, 403);
  }

  if (msg.deleted_at || msg.content.startsWith("[system]")) {
    return c.json({ error: "Cannot edit this message" }, 400);
  }

  const ageMs = Date.now() - new Date(msg.created_at).getTime();
  if (ageMs >= 20 * 60 * 1000) {
    return c.json({ error: "Message too old to edit" }, 403);
  }

  db.run(
    `UPDATE dm_messages SET content = ?, edited_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    [content.trim(), messageId]
  );

  const updated = db
    .query("SELECT edited_at FROM dm_messages WHERE id = ?")
    .get(messageId) as any;

  const participants = db
    .query("SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'")
    .all(channelId, user.id) as any[];

  for (const p of participants) {
    sendToUser(p.user_id, "DM_MESSAGE_EDITED", {
      channel_id: channelId,
      message_id: messageId,
      content: content.trim(),
      edited_at: updated.edited_at,
    });
  }

  return c.json({ ok: true, edited_at: updated.edited_at });
});

// Delete a message (for everyone or just for me)
dms.delete("/:id/messages/:messageId", async (c) => {
  const user = c.get("user");
  const channelId = c.req.param("id");
  const messageId = c.req.param("messageId");
  const type = c.req.query("type") || "me";
  const db = getDb();

  // Verify user is a participant
  const participant = db
    .query(
      "SELECT status FROM dm_participants WHERE dm_channel_id = ? AND user_id = ?"
    )
    .get(channelId, user.id) as any;

  if (!participant) {
    return c.json({ error: "Not found" }, 404);
  }

  // Get the message
  const msg = db
    .query(
      "SELECT id, author_id, content, created_at, deleted_at FROM dm_messages WHERE id = ? AND dm_channel_id = ?"
    )
    .get(messageId, channelId) as any;

  if (!msg) {
    return c.json({ error: "Message not found" }, 404);
  }

  if (type === "everyone") {
    // Already deleted for everyone
    if (msg.deleted_at) {
      return c.json({ error: "Already deleted" }, 400);
    }

    // Check permissions: own message < 20 min OR group owner
    const channel = db
      .query("SELECT is_group, owner_id FROM dm_channels WHERE id = ?")
      .get(channelId) as any;

    const isGroupOwner = channel?.is_group && channel.owner_id === user.id;
    const isOwnMessage = msg.author_id === user.id;
    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    const within20Min = ageMs < 20 * 60 * 1000;

    if (!isGroupOwner && !(isOwnMessage && within20Min)) {
      return c.json({ error: "Cannot delete this message" }, 403);
    }

    const systemContent = `[system] ${user.username} deleted a message`;
    db.run(
      `UPDATE dm_messages SET content = ?, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      [systemContent, messageId]
    );

    // Notify all active participants
    const participants = db
      .query(
        "SELECT user_id FROM dm_participants WHERE dm_channel_id = ? AND user_id != ? AND status = 'active'"
      )
      .all(channelId, user.id) as any[];

    for (const p of participants) {
      sendToUser(p.user_id, "DM_MESSAGE_DELETED", {
        channel_id: channelId,
        message_id: messageId,
        deleted_by: user.username,
        content: systemContent,
      });
    }

    return c.json({ ok: true });
  } else {
    // Delete for me only
    db.run(
      "INSERT OR IGNORE INTO dm_message_deletions (dm_message_id, user_id) VALUES (?, ?)",
      [messageId, user.id]
    );
    return c.json({ ok: true });
  }
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
