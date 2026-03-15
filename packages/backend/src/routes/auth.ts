import { Hono } from "hono";
import { getDb } from "@tulpo/db";
import { registerSchema, loginSchema } from "@tulpo/shared";
import type { PublicUser } from "@tulpo/shared";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  cleanExpiredSessions,
} from "../lib/auth";
import { authMiddleware } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { bruteForceCheck, recordFailure, resetFailures } from "../middleware/bruteForce";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

const auth = new Hono<AuthEnv>();

// Rate limit all auth routes: 20 requests per minute per IP
auth.use("/*", rateLimit({ windowMs: 60_000, maxAttempts: 20 }));

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { email, username, password } = parsed.data;
  const db = getDb();

  // Check uniqueness
  const existing = db
    .query("SELECT id FROM users WHERE email = ? OR username = ?")
    .get(email, username) as any;

  if (existing) {
    return c.json({ error: "Email or username already taken" }, 409);
  }

  const passwordHash = await hashPassword(password);

  const result = db
    .query(
      `INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?) RETURNING id, email, username, display_name, avatar_url, avatar_type, avatar_color, status`
    )
    .get(email, username, passwordHash) as any;

  const session = createSession(
    result.id,
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    c.req.header("user-agent")
  );

  return c.json(
    {
      user: {
        id: result.id,
        username: result.username,
        display_name: result.display_name,
        avatar_url: result.avatar_url,
        avatar_type: result.avatar_type,
        avatar_color: result.avatar_color,
        status: result.status,
      },
      token: session.token,
    },
    201
  );
});

auth.post("/login", bruteForceCheck(), async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { email, password } = parsed.data;
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || "unknown";
  const db = getDb();

  const user = db
    .query(
      "SELECT id, email, username, display_name, avatar_url, avatar_type, avatar_color, status, password_hash FROM users WHERE email = ?"
    )
    .get(email) as any;

  if (!user) {
    recordFailure(ip, email);
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    recordFailure(ip, email);
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Successful login — reset brute force counters
  resetFailures(ip, email);

  // Clean up expired sessions for this user
  cleanExpiredSessions(user.id);

  const session = createSession(
    user.id,
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    c.req.header("user-agent")
  );

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      avatar_type: user.avatar_type,
      avatar_color: user.avatar_color,
      status: user.status,
    },
    token: session.token,
  });
});

auth.post("/logout", authMiddleware, (c) => {
  const token = c.get("token") as string;
  deleteSession(token);
  return c.body(null, 204);
});

auth.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json({ user });
});

export { auth };
