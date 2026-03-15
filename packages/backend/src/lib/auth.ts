import { getDb } from "@tulpo/db";
import { SESSION_DURATION_MS } from "@tulpo/shared";
import { env } from "./env";

function peppered(password: string): string {
  return password + env.pepper;
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(peppered(password), {
    algorithm: "argon2id",
    timeCost: 5,
    memoryCost: 65536,
  });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(peppered(password), hash);
}

export function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): { token: string; expiresAt: string } {
  const db = getDb();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.run(
    "INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
    [userId, token, expiresAt, ipAddress || null, userAgent || null]
  );

  return { token, expiresAt };
}

export function validateSession(token: string) {
  const db = getDb();
  const row = db
    .query(
      `SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, u.avatar_type, u.avatar_color, u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
    .get(token) as any;

  return row || null;
}

export function deleteSession(token: string): void {
  const db = getDb();
  db.run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function cleanExpiredSessions(userId: string): void {
  const db = getDb();
  db.run(
    "DELETE FROM sessions WHERE user_id = ? AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
    [userId]
  );
}
