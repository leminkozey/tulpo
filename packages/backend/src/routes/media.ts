import { Hono } from "hono";
import type { PublicUser } from "@tulpo/shared";
import { authMiddleware } from "../middleware/auth";
import { env } from "../lib/env";

type AuthEnv = {
  Variables: {
    user: PublicUser;
    token: string;
  };
};

const media = new Hono<AuthEnv>();

media.use("/*", authMiddleware);

const GIPHY_BASE = "https://api.giphy.com/v1";

// GIF search
media.get("/gifs/search", async (c) => {
  if (!env.giphyApiKey) return c.json({ data: [] });
  const q = c.req.query("q") || "";
  if (!q.trim()) return c.json({ data: [] });

  const params = new URLSearchParams({
    api_key: env.giphyApiKey,
    q,
    limit: c.req.query("limit") || "20",
    offset: c.req.query("offset") || "0",
    rating: "pg-13",
    lang: "en",
  });

  const res = await fetch(`${GIPHY_BASE}/gifs/search?${params}`);
  const json = await res.json();
  return c.json({ data: mapGiphyResults(json.data || []) });
});

// GIF trending
media.get("/gifs/trending", async (c) => {
  if (!env.giphyApiKey) return c.json({ data: [] });

  const params = new URLSearchParams({
    api_key: env.giphyApiKey,
    limit: c.req.query("limit") || "20",
    offset: c.req.query("offset") || "0",
    rating: "pg-13",
  });

  const res = await fetch(`${GIPHY_BASE}/gifs/trending?${params}`);
  const json = await res.json();
  return c.json({ data: mapGiphyResults(json.data || []) });
});

// Sticker search
media.get("/stickers/search", async (c) => {
  if (!env.giphyApiKey) return c.json({ data: [] });
  const q = c.req.query("q") || "";
  if (!q.trim()) return c.json({ data: [] });

  const params = new URLSearchParams({
    api_key: env.giphyApiKey,
    q,
    limit: c.req.query("limit") || "20",
    offset: c.req.query("offset") || "0",
    rating: "pg-13",
    lang: "en",
  });

  const res = await fetch(`${GIPHY_BASE}/stickers/search?${params}`);
  const json = await res.json();
  return c.json({ data: mapGiphyResults(json.data || []) });
});

// Sticker trending
media.get("/stickers/trending", async (c) => {
  if (!env.giphyApiKey) return c.json({ data: [] });

  const params = new URLSearchParams({
    api_key: env.giphyApiKey,
    limit: c.req.query("limit") || "20",
    offset: c.req.query("offset") || "0",
    rating: "pg-13",
  });

  const res = await fetch(`${GIPHY_BASE}/stickers/trending?${params}`);
  const json = await res.json();
  return c.json({ data: mapGiphyResults(json.data || []) });
});

function mapGiphyResults(data: any[]) {
  return data.map((item: any) => ({
    id: item.id,
    title: item.title || "",
    url: item.images?.original?.url || item.images?.fixed_height?.url || "",
    preview: item.images?.fixed_height_small?.url || item.images?.preview_gif?.url || item.images?.fixed_height?.url || "",
    width: Number(item.images?.fixed_height?.width) || 200,
    height: Number(item.images?.fixed_height?.height) || 200,
    source: "giphy",
  }));
}

export { media };
