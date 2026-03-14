import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxAttempts: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000);

function getClientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    || c.req.header("x-real-ip")
    || "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxAttempts } = options;

  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const now = Date.now();
    const entry = store.get(ip);

    if (entry && entry.resetAt > now) {
      entry.count++;
      if (entry.count > maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        c.header("Retry-After", String(retryAfter));
        return c.json({ error: "Too many requests, try again later" }, 429);
      }
    } else {
      store.set(ip, { count: 1, resetAt: now + windowMs });
    }

    await next();
  };
}
