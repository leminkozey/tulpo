import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

const EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours

export function signUrl(path: string): string {
  const expires = Date.now() + EXPIRY_MS;
  const sig = createHmac("sha256", env.sessionSecret)
    .update(`${path}:${expires}`)
    .digest("hex")
    .slice(0, 40);
  return `${path}?expires=${expires}&sig=${sig}`;
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
    .slice(0, 40);

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
