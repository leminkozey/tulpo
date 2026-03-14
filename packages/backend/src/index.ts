import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getDb } from "@tulpo/db";
import { env } from "./lib/env";
import { corsMiddleware } from "./middleware/cors";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { wsHandler, startHeartbeatChecker } from "./ws/handler";
import { validateSession } from "./lib/auth";
import type { WsData } from "./ws/types";

// Initialize database
getDb();

const app = new Hono();

// Middleware
app.use("*", corsMiddleware);

// API routes
app.route("/api", health);
app.route("/api/auth", auth);

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
        data: { userId, isAlive: true } satisfies WsData,
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
