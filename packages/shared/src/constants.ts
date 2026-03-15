export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const WS_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const WS_HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds
export const DEFAULT_PORT = 3000;

// Friends
export const FRIEND_REQUEST_NOTE_MAX_LENGTH = 200;

// File uploads
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Image types that get re-encoded via Sharp (displayed inline)
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

// Blocked types that should never be uploaded (served inline = XSS risk)
export const BLOCKED_MIME_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
] as const;
