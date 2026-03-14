import type { Context, Next } from "hono";

interface BruteForceEntry {
  failures: number;
  lockedUntil: number | null;
}

const store = new Map<string, BruteForceEntry>();

// Cleanup expired locks every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.lockedUntil && entry.lockedUntil <= now) {
      store.delete(key);
    }
  }
}, 60_000);

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function getLockDuration(failures: number): number | null {
  if (failures >= 20) return TWENTY_FOUR_HOURS;
  if (failures >= 10) return ONE_HOUR;
  if (failures >= 5) return FIFTEEN_MIN;
  return null;
}

function getClientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || "unknown";
}

/** Check if either the IP or email is currently locked out */
export function bruteForceCheck() {
  return async (c: Context, next: Next) => {
    const body = await c.req.json();
    // Re-set the body so downstream handlers can read it again
    c.req.raw = new Request(c.req.raw, { body: JSON.stringify(body) });

    const ip = getClientIp(c);
    const email = body?.email as string | undefined;
    const now = Date.now();

    // Check IP lock
    const ipEntry = store.get(`ip:${ip}`);
    if (ipEntry?.lockedUntil && ipEntry.lockedUntil > now) {
      const retryAfter = Math.ceil((ipEntry.lockedUntil - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many failed attempts, try again later" }, 429);
    }

    // Check email/account lock
    if (email) {
      const emailEntry = store.get(`email:${email}`);
      if (emailEntry?.lockedUntil && emailEntry.lockedUntil > now) {
        const retryAfter = Math.ceil((emailEntry.lockedUntil - now) / 1000);
        c.header("Retry-After", String(retryAfter));
        return c.json({ error: "Too many failed attempts, try again later" }, 429);
      }
    }

    await next();
  };
}

/** Record a failed login attempt for both IP and email */
export function recordFailure(ip: string, email: string): void {
  const now = Date.now();

  for (const key of [`ip:${ip}`, `email:${email}`]) {
    const entry = store.get(key) || { failures: 0, lockedUntil: null };
    entry.failures++;
    const lockDuration = getLockDuration(entry.failures);
    entry.lockedUntil = lockDuration ? now + lockDuration : null;
    store.set(key, entry);
  }
}

/** Reset failure counters on successful login */
export function resetFailures(ip: string, email: string): void {
  store.delete(`ip:${ip}`);
  store.delete(`email:${email}`);
}
