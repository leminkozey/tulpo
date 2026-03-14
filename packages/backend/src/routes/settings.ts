import { Hono } from "hono";
import { getDb } from "@tulpo/db";
import { updateUserSettingsSchema } from "@tulpo/shared";
import type { PublicUser } from "@tulpo/shared";
import { authMiddleware } from "../middleware/auth";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

const settings = new Hono<AuthEnv>();

settings.use("/*", authMiddleware);

// Get user settings
settings.get("/", (c) => {
  const user = c.get("user");
  const db = getDb();

  const row = db
    .query("SELECT * FROM user_settings WHERE user_id = ?")
    .get(user.id) as any;

  // Return defaults if no settings row exists
  return c.json({
    user_id: user.id,
    allow_friend_request_notes: row ? !!row.allow_friend_request_notes : true,
  });
});

// Update user settings
settings.patch("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updateUserSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const db = getDb();
  const data = parsed.data;

  // Upsert settings
  db.run(
    `INSERT INTO user_settings (user_id, allow_friend_request_notes, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(user_id) DO UPDATE SET
       allow_friend_request_notes = COALESCE(?, allow_friend_request_notes),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [
      user.id,
      data.allow_friend_request_notes !== undefined
        ? data.allow_friend_request_notes
          ? 1
          : 0
        : 1,
      data.allow_friend_request_notes !== undefined
        ? data.allow_friend_request_notes
          ? 1
          : 0
        : null,
    ]
  );

  const row = db
    .query("SELECT * FROM user_settings WHERE user_id = ?")
    .get(user.id) as any;

  return c.json({
    user_id: user.id,
    allow_friend_request_notes: !!row.allow_friend_request_notes,
  });
});

export { settings };
