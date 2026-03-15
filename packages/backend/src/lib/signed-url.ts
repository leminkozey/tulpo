import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

const EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours

export function signUrl(path: string): string {
  const expires = Date.now() + EXPIRY_MS;
  const sig = createHmac("sha256", env.sessionSecret)
    .update(`${path}:${expires}`)
    .digest("hex")
    ;
  return `${path}?expires=${expires}&sig=${sig}`;
}

/** Sign avatar_url (and optionally banner_url) on a user-like object in-place */
export function signUserUrls<T extends Record<string, any>>(user: T): T {
  if (user?.avatar_url && typeof user.avatar_url === "string" && user.avatar_url.startsWith("/uploads/")) {
    user.avatar_url = signUrl(user.avatar_url);
  }
  if (user?.banner_url && typeof user.banner_url === "string" && user.banner_url.startsWith("/uploads/")) {
    user.banner_url = signUrl(user.banner_url);
  }
  return user;
}

export function verifySignedUrl(
  path: string,
  expires: string,
  sig: string
): boolean {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || Date.now() > expiresNum) return false;

  const expected = createHmac("sha256", env.sessionSecret)
    .update(`${path}:${expiresNum}`)
    .digest("hex")
    ;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
