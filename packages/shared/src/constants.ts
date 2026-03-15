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

// Blocked types that should never be uploaded (executable code)
export const BLOCKED_MIME_TYPES = [
  "application/javascript",
  "text/javascript",
] as const;

// Voice calls
export const CALL_RING_TIMEOUT_MS = 30_000; // 30s ringing before auto-cancel
export const CALL_REJOIN_TIMEOUT_MS = 180_000; // 3 min rejoin window
export const CALL_MAX_PARTICIPANTS = 8; // Mesh topology limit
export const VAD_THRESHOLD_DEFAULT = 0.02; // Voice activity detection default
