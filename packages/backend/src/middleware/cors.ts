import { cors } from "hono/cors";
import { env } from "../lib/env";

export const corsMiddleware = cors({
  origin: env.isProd ? "" : "http://localhost:5173",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
});
