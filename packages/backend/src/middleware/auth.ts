import type { Context, Next } from "hono";
import type { PublicUser } from "@tulpo/shared";
import { validateSession } from "../lib/auth";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = header.slice(7);
  const user = validateSession(token);

  if (!user) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  c.set("user", user);
  c.set("token", token);
  await next();
}
