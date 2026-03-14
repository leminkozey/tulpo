export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const WS_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const WS_HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds
export const DEFAULT_PORT = 3000;

// Friends
export const FRIEND_REQUEST_NOTE_MAX_LENGTH = 200;

// File uploads
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "video/mp4",
  "audio/mpeg",
  "audio/ogg",
];
