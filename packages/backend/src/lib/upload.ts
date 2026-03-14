import sharp from "sharp";
import { env } from "./env";

const MAX_IMAGE_DIMENSION = 4000;
const MAX_IMAGE_PIXELS = 16_000_000; // 16 megapixels (matches 4000x4000)

// Concurrency limit for Sharp image processing
let activeProcessing = 0;
const MAX_CONCURRENT_PROCESSING = 4;

// ===== Magic Bytes Verification =====

export function verifyMagicBytes(
  header: Uint8Array,
  mimeType: string
): boolean {
  const hex = Array.from(header.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  switch (mimeType) {
    case "image/jpeg":
      return hex.startsWith("ffd8ff");
    case "image/png":
      return hex.startsWith("89504e47");
    case "image/gif":
      return hex.startsWith("47494638");
    case "image/webp":
      return (
        hex.startsWith("52494646") &&
        Array.from(header.slice(8, 12))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("") === "57454250"
      );
    case "application/pdf":
      return hex.startsWith("25504446");
    case "application/zip":
    case "application/x-zip-compressed":
      return hex.startsWith("504b0304") || hex.startsWith("504b0506");
    case "video/mp4":
      return (
        Array.from(header.slice(4, 8))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("") === "66747970"
      );
    case "audio/mpeg":
      // MP3 sync words: 0xFFFB, 0xFFF3, 0xFFF2, or ID3 tag
      return (
        hex.startsWith("fffb") ||
        hex.startsWith("fff3") ||
        hex.startsWith("fff2") ||
        hex.startsWith("494433")
      );
    case "audio/ogg":
      return hex.startsWith("4f676753");
    case "text/plain":
      return (
        !hex.startsWith("ffd8") &&
        !hex.startsWith("8950") &&
        !hex.startsWith("504b") &&
        !hex.startsWith("7f454c46")
      );
    default:
      return false;
  }
}

// ===== Polyglot / Content Safety Checks =====

export function checkFileSafety(
  buffer: Uint8Array,
  mimeType: string
): { safe: boolean; reason?: string } {
  // Check for HTML/script content in non-text files
  if (mimeType !== "text/plain") {
    // Check both head and tail of the file for embedded scripts
    const headSample = new TextDecoder("utf-8", { fatal: false }).decode(
      buffer.slice(0, 8192)
    );
    const tailSample =
      buffer.length > 8192
        ? new TextDecoder("utf-8", { fatal: false }).decode(
            buffer.slice(-4096)
          )
        : "";

    for (const sample of [headSample, tailSample]) {
      const lower = sample.toLowerCase();
      if (
        lower.includes("<script") ||
        lower.includes("<html") ||
        lower.includes("<!doctype") ||
        lower.includes("javascript:") ||
        lower.includes("vbscript:") ||
        lower.includes("<iframe") ||
        lower.includes("<object") ||
        lower.includes("<embed")
      ) {
        return { safe: false, reason: "File contains HTML/script content" };
      }
    }
  }

  // PDF-specific: check for dangerous actions
  if (mimeType === "application/pdf") {
    const content = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const dangerousPatterns = [
      /\/JavaScript\s/i,
      /\/JS\s/i,
      /\/Launch\s/i,
      /\/SubmitForm\s/i,
      /\/ImportData\s/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return {
          safe: false,
          reason: "PDF contains potentially dangerous actions",
        };
      }
    }
  }

  // Check for polyglot: ZIP signature embedded in image files
  if (mimeType.startsWith("image/")) {
    // Check last 256 bytes for ZIP local file header
    const tailHex = Array.from(buffer.slice(-256))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (tailHex.includes("504b0304")) {
      return { safe: false, reason: "Image contains embedded ZIP data" };
    }
  }

  // Text file: ensure it doesn't contain binary content
  if (mimeType === "text/plain") {
    const sample = buffer.slice(0, 8192);
    let nullCount = 0;
    for (const byte of sample) {
      if (byte === 0) nullCount++;
    }
    // More than 1% null bytes = likely binary, not text
    if (nullCount > sample.length * 0.01) {
      return { safe: false, reason: "File appears to be binary, not text" };
    }
  }

  return { safe: true };
}

// ===== Image Processing (Strip metadata, re-encode, limit dimensions) =====

export async function processImage(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer> {
  // Concurrency gate: prevent DoS via parallel image processing
  if (activeProcessing >= MAX_CONCURRENT_PROCESSING) {
    throw new Error("Too many concurrent image processing operations");
  }
  activeProcessing++;

  try {
    const sharpOpts: sharp.SharpOptions = {
      limitInputPixels: MAX_IMAGE_PIXELS,
    };

    if (mimeType === "image/gif") {
      sharpOpts.animated = true;
    }

    let pipeline = sharp(buffer, sharpOpts)
      .rotate() // auto-rotate based on EXIF before stripping
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });

    switch (mimeType) {
      case "image/jpeg":
        pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
        break;
      case "image/png":
        pipeline = pipeline.png({ compressionLevel: 8 });
        break;
      case "image/webp":
        pipeline = pipeline.webp({ quality: 90 });
        break;
      case "image/gif":
        pipeline = pipeline.gif();
        break;
    }

    return await pipeline.toBuffer();
  } finally {
    activeProcessing--;
  }
}

// ===== ClamAV Virus Scanning (optional, fail-closed when configured) =====

export async function scanWithClamAV(
  data: Uint8Array
): Promise<{ clean: boolean; virus?: string }> {
  if (!env.clamavHost) return { clean: true };

  const [host, portStr] = env.clamavHost.split(":");
  const port = parseInt(portStr || "3310", 10);

  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.error("ClamAV scan timeout — rejecting upload");
      resolve({ clean: false, virus: "scan_timeout" });
    }, 30_000);

    try {
      let response = "";

      await Bun.connect({
        hostname: host,
        port,
        socket: {
          open(socket) {
            // Send zINSTREAM command (null-terminated)
            const cmd = new TextEncoder().encode("zINSTREAM\0");
            socket.write(cmd);

            // Send data in chunks with 4-byte big-endian length prefix
            const CHUNK_SIZE = 8192;
            for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
              const chunk = data.subarray(
                offset,
                Math.min(offset + CHUNK_SIZE, data.length)
              );
              const lenBuf = new Uint8Array(4);
              new DataView(lenBuf.buffer).setUint32(0, chunk.length);
              socket.write(lenBuf);
              socket.write(chunk);
            }

            // Terminate stream with 4 zero bytes
            socket.write(new Uint8Array(4));
          },
          data(_socket, received) {
            response += new TextDecoder().decode(received);
          },
          close() {
            clearTimeout(timeout);
            const trimmed = response.trim();
            // Check FOUND first — prevents "OK" substring in virus name from false-positive
            if (trimmed.includes("FOUND")) {
              const match = trimmed.match(/stream: (.+) FOUND/);
              resolve({
                clean: false,
                virus: match?.[1] || "unknown",
              });
            } else if (trimmed.endsWith("OK")) {
              resolve({ clean: true });
            } else {
              // Unexpected response — fail closed
              console.error("ClamAV unexpected response:", trimmed);
              resolve({ clean: false, virus: "unexpected_response" });
            }
          },
          error(_socket, err) {
            clearTimeout(timeout);
            console.error("ClamAV error:", err);
            // Fail closed: configured but unavailable = reject
            resolve({ clean: false, virus: "scan_error" });
          },
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error("ClamAV connection failed:", err);
      // Fail closed
      resolve({ clean: false, virus: "connection_failed" });
    }
  });
}

// ===== Upload Rate Limiting =====

const MAX_RATE_ENTRIES = 10_000;
const uploadTimes = new Map<string, number[]>();
const UPLOAD_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const UPLOAD_MAX = 50; // 50 uploads per hour

export function checkUploadRateLimit(
  userId: string
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const times = uploadTimes.get(userId) ?? [];
  const recent = times.filter((t) => now - t < UPLOAD_WINDOW_MS);
  uploadTimes.set(userId, recent);

  if (recent.length >= UPLOAD_MAX) {
    const oldest = recent[0];
    return {
      allowed: false,
      retryAfterMs: UPLOAD_WINDOW_MS - (now - oldest),
    };
  }

  recent.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

// Cleanup old entries every 10 minutes, cap total entries
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of uploadTimes) {
    const recent = times.filter((t) => now - t < UPLOAD_WINDOW_MS);
    if (recent.length === 0) {
      uploadTimes.delete(key);
    } else {
      uploadTimes.set(key, recent);
    }
  }
  // Hard cap on map size to prevent memory exhaustion
  if (uploadTimes.size > MAX_RATE_ENTRIES) {
    const excess = uploadTimes.size - MAX_RATE_ENTRIES;
    const keys = uploadTimes.keys();
    for (let i = 0; i < excess; i++) {
      const key = keys.next().value;
      if (key) uploadTimes.delete(key);
    }
  }
}, 10 * 60 * 1000);
