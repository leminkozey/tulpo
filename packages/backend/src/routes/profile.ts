import { Hono } from "hono";
import { getDb } from "@tulpo/db";
import type { PublicUser } from "@tulpo/shared";
import { updateProfileSchema, IMAGE_MIME_TYPES, MAX_IMAGE_SIZE } from "@tulpo/shared";
import { authMiddleware } from "../middleware/auth";
import { signUrl } from "../lib/signed-url";
import {
  verifyMagicBytes,
  checkFileSafety,
  processImage,
  scanWithClamAV,
  checkUploadRateLimit,
} from "../lib/upload";
import sharp from "sharp";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";
import { randomBytes } from "crypto";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

const profile = new Hono<AuthEnv>();

profile.use("/*", authMiddleware);

// Helper: get user profile with links
function getUserProfile(userId: string) {
  const db = getDb();
  const user = db
    .query(
      `SELECT id, username, display_name, avatar_url, avatar_type, avatar_color, status, bio, pronouns, banner_url, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as any;

  if (!user) return null;

  const links = db
    .query(
      `SELECT id, label, url, position FROM user_links WHERE user_id = ? ORDER BY position ASC`
    )
    .all(userId) as any[];

  // Sign avatar/banner URLs
  if (user.avatar_url && user.avatar_url.startsWith("/uploads/")) {
    user.avatar_url = signUrl(user.avatar_url);
  }
  if (user.banner_url && user.banner_url.startsWith("/uploads/")) {
    user.banner_url = signUrl(user.banner_url);
  }

  return { ...user, bio: user.bio || "", pronouns: user.pronouns || "", links };
}

// GET /api/profile — own profile
profile.get("/", (c) => {
  const user = c.get("user");
  const result = getUserProfile(user.id);
  if (!result) return c.json({ error: "User not found" }, 404);
  return c.json(result);
});

// GET /api/profile/:userId — other user's profile
profile.get("/:userId", (c) => {
  const userId = c.req.param("userId");
  const result = getUserProfile(userId);
  if (!result) return c.json({ error: "User not found" }, 404);
  return c.json(result);
});

// PATCH /api/profile — update own profile
profile.patch("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const db = getDb();
  const data = parsed.data;

  // Update user fields
  const updates: string[] = [];
  const values: any[] = [];

  if (data.display_name !== undefined) {
    updates.push("display_name = ?");
    values.push(data.display_name);
  }
  if (data.bio !== undefined) {
    updates.push("bio = ?");
    values.push(data.bio);
  }
  if (data.pronouns !== undefined) {
    updates.push("pronouns = ?");
    values.push(data.pronouns);
  }
  if (data.avatar_color !== undefined) {
    updates.push("avatar_color = ?");
    values.push(data.avatar_color);
  }

  if (updates.length > 0) {
    updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    values.push(user.id);
    db.run(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
  }

  // Update links (replace all)
  if (data.links !== undefined) {
    db.run("DELETE FROM user_links WHERE user_id = ?", [user.id]);
    for (let i = 0; i < data.links.length; i++) {
      const link = data.links[i];
      db.run(
        "INSERT INTO user_links (user_id, label, url, position) VALUES (?, ?, ?, ?)",
        [user.id, link.label, link.url, i]
      );
    }
  }

  const result = getUserProfile(user.id);
  return c.json(result);
});

// POST /api/profile/avatar — upload avatar image/gif
profile.post("/avatar", async (c) => {
  const user = c.get("user");

  const rateCheck = checkUploadRateLimit(user.id);
  if (!rateCheck.allowed) {
    return c.json(
      { error: "Too many uploads. Try again later." },
      429
    );
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const mimeType = file.type.split(";")[0].trim();
  if (!IMAGE_MIME_TYPES.includes(mimeType as any)) {
    return c.json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed" }, 400);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return c.json({ error: "Image must be under 10 MB" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Magic bytes verification
  const magicOk = verifyMagicBytes(new Uint8Array(buffer.slice(0, 12)), mimeType);
  if (magicOk === false) {
    return c.json({ error: "File type does not match its content" }, 400);
  }

  // Safety check
  const safety = checkFileSafety(new Uint8Array(buffer), mimeType);
  if (!safety.safe) {
    return c.json({ error: safety.reason || "File failed safety check" }, 400);
  }

  // Virus scan
  const scanResult = await scanWithClamAV(new Uint8Array(buffer));
  if (!scanResult.clean) {
    return c.json({ error: "File failed security scan" }, 400);
  }

  // Parse optional crop parameters (for GIF cropping)
  const cropRaw = formData.get("crop") as string | null;
  let cropParams: { x: number; y: number; w: number; h: number } | null = null;
  if (cropRaw) {
    try {
      const parsed = JSON.parse(cropRaw);
      if (parsed.x >= 0 && parsed.y >= 0 && parsed.w > 0 && parsed.h > 0) {
        cropParams = { x: Math.round(parsed.x), y: Math.round(parsed.y), w: Math.round(parsed.w), h: Math.round(parsed.h) };
      }
    } catch { /* ignore invalid crop params */ }
  }

  // Process image (strip metadata, resize)
  let processed: Buffer;
  if (cropParams && mimeType === "image/gif") {
    // Animated GIF crop: extract region then resize, preserving animation
    processed = await sharp(buffer, { animated: true })
      .extract({ left: cropParams.x, top: cropParams.y, width: cropParams.w, height: cropParams.h })
      .resize(512, 512, { fit: "cover" })
      .gif()
      .toBuffer();
  } else {
    processed = await processImage(buffer, mimeType);
  }

  // Save file
  const ext = mimeType === "image/gif" ? "gif" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const filename = `avatar_${user.id}_${randomBytes(8).toString("hex")}.${ext}`;
  const dir = join("data", "uploads", "avatars");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, filename);
  await Bun.write(filePath, processed);

  // Delete old avatar file if exists
  const db = getDb();
  const old = db.query("SELECT avatar_url FROM users WHERE id = ?").get(user.id) as any;
  if (old?.avatar_url?.startsWith("/uploads/avatars/")) {
    try {
      await unlink(join("data", old.avatar_url));
    } catch { /* old file may not exist */ }
  }

  const avatarUrl = `/uploads/avatars/${filename}`;
  const avatarType = mimeType === "image/gif" ? "gif" : "image";

  db.run(
    "UPDATE users SET avatar_url = ?, avatar_type = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [avatarUrl, avatarType, user.id]
  );

  return c.json({
    avatar_url: signUrl(avatarUrl),
    avatar_type: avatarType,
  });
});

// DELETE /api/profile/avatar — reset to color avatar
profile.delete("/avatar", async (c) => {
  const user = c.get("user");
  const db = getDb();

  // Delete old file
  const old = db.query("SELECT avatar_url FROM users WHERE id = ?").get(user.id) as any;
  if (old?.avatar_url?.startsWith("/uploads/avatars/")) {
    try {
      await unlink(join("data", old.avatar_url));
    } catch { /* ok */ }
  }

  db.run(
    "UPDATE users SET avatar_url = NULL, avatar_type = 'color', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [user.id]
  );

  return c.json({ avatar_url: null, avatar_type: "color" });
});

// POST /api/profile/banner — upload banner image/gif
profile.post("/banner", async (c) => {
  const user = c.get("user");

  const rateCheck = checkUploadRateLimit(user.id);
  if (!rateCheck.allowed) {
    return c.json({ error: "Too many uploads. Try again later." }, 429);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const mimeType = file.type.split(";")[0].trim();
  if (!IMAGE_MIME_TYPES.includes(mimeType as any)) {
    return c.json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed" }, 400);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return c.json({ error: "Image must be under 10 MB" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const magicOk = verifyMagicBytes(new Uint8Array(buffer.slice(0, 12)), mimeType);
  if (magicOk === false) {
    return c.json({ error: "File type does not match its content" }, 400);
  }

  const safety = checkFileSafety(new Uint8Array(buffer), mimeType);
  if (!safety.safe) {
    return c.json({ error: safety.reason || "File failed safety check" }, 400);
  }

  const scanResult = await scanWithClamAV(new Uint8Array(buffer));
  if (!scanResult.clean) {
    return c.json({ error: "File failed security scan" }, 400);
  }

  // Parse optional crop parameters
  const cropRaw = formData.get("crop") as string | null;
  let cropParams: { x: number; y: number; w: number; h: number } | null = null;
  if (cropRaw) {
    try {
      const parsed = JSON.parse(cropRaw);
      if (parsed.x >= 0 && parsed.y >= 0 && parsed.w > 0 && parsed.h > 0) {
        cropParams = { x: Math.round(parsed.x), y: Math.round(parsed.y), w: Math.round(parsed.w), h: Math.round(parsed.h) };
      }
    } catch { /* ignore */ }
  }

  let processed: Buffer;
  if (cropParams && mimeType === "image/gif") {
    processed = await sharp(buffer, { animated: true })
      .extract({ left: cropParams.x, top: cropParams.y, width: cropParams.w, height: cropParams.h })
      .resize(960, 320, { fit: "cover" })
      .gif()
      .toBuffer();
  } else {
    processed = await processImage(buffer, mimeType);
  }

  const ext = mimeType === "image/gif" ? "gif" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const filename = `banner_${user.id}_${randomBytes(8).toString("hex")}.${ext}`;
  const dir = join("data", "uploads", "banners");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, filename);
  await Bun.write(filePath, processed);

  // Delete old banner
  const db = getDb();
  const old = db.query("SELECT banner_url FROM users WHERE id = ?").get(user.id) as any;
  if (old?.banner_url?.startsWith("/uploads/banners/")) {
    try {
      await unlink(join("data", old.banner_url));
    } catch { /* ok */ }
  }

  const bannerUrl = `/uploads/banners/${filename}`;
  db.run(
    "UPDATE users SET banner_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [bannerUrl, user.id]
  );

  return c.json({ banner_url: signUrl(bannerUrl) });
});

// DELETE /api/profile/banner — remove banner
profile.delete("/banner", async (c) => {
  const user = c.get("user");
  const db = getDb();

  const old = db.query("SELECT banner_url FROM users WHERE id = ?").get(user.id) as any;
  if (old?.banner_url?.startsWith("/uploads/banners/")) {
    try {
      await unlink(join("data", old.banner_url));
    } catch { /* ok */ }
  }

  db.run(
    "UPDATE users SET banner_url = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [user.id]
  );

  return c.json({ banner_url: null });
});

export { profile };
