import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getDb, runMigrations } from "@tulpo/db";
import { env } from "./lib/env";
import { corsMiddleware } from "./middleware/cors";
import { rateLimit } from "./middleware/rateLimit";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { friends } from "./routes/friends";
import { settings } from "./routes/settings";
import { dms } from "./routes/dms";
import { wsHandler, startHeartbeatChecker } from "./ws/handler";
import { validateSession } from "./lib/auth";
import { verifySignedUrl } from "./lib/signed-url";
import type { WsData } from "./ws/types";

// Initialize database + run pending migrations
getDb();
runMigrations();

// Reset all users to offline on startup (connection pool is empty)
getDb().run("UPDATE users SET status = 'offline' WHERE status != 'offline'");

const app = new Hono();

// Middleware
app.use("*", corsMiddleware);

// Global API rate limit: 200 requests per minute per IP
app.use("/api/*", rateLimit({ windowMs: 60_000, maxAttempts: 200 }));

// Serve uploaded files — signed URL verification, force download for non-images
app.use("/uploads/*", async (c, next) => {
  // Verify HMAC-signed URL (no session token in URLs)
  const expires = c.req.query("expires");
  const sig = c.req.query("sig");
  if (!expires || !sig || !verifySignedUrl(c.req.path, expires, sig)) {
    return c.json({ error: "Invalid or expired URL" }, 403);
  }

  await next();

  // Force download for non-image files (prevents XSS from HTML/SVG)
  const contentType = c.res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    c.res.headers.set("Content-Disposition", "attachment");
  }
  // Block scripts in all cases
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
  c.res.headers.set("Cache-Control", "private, max-age=3600");
}, serveStatic({ root: "./data" }));

// API routes
app.route("/api", health);
app.route("/api/auth", auth);
app.route("/api/friends", friends);
app.route("/api/settings", settings);
app.route("/api/dms", dms);

// Serve static frontend in production
if (env.isProd) {
  app.use("/*", serveStatic({ root: "./packages/frontend/build" }));
  // SPA fallback
  app.get("*", serveStatic({ path: "./packages/frontend/build/index.html" }));
}

// Start server
const server = Bun.serve({
  port: env.port,
  fetch(req, server) {
    // WebSocket upgrade
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const token = url.searchParams.get("token");
      let userId: string | null = null;

      // Pre-auth via query param (optional, can also IDENTIFY after connect)
      if (token) {
        const user = validateSession(token);
        if (user) userId = user.id;
      }

      const upgraded = server.upgrade(req, {
        data: { userId, token, isAlive: true } satisfies WsData,
      });

      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: wsHandler,
});

startHeartbeatChecker();

console.log(`Tulpo backend running on http://localhost:${server.port}`);
