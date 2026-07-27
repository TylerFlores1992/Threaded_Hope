/**
 * Shared SEO constants. `SITE_URL` is the canonical origin (no trailing slash);
 * override via NEXT_PUBLIC_BASE_URL. `SITE_KEYWORDS` are broad, relevant terms
 * reused across metadata — keep them honest to what the shop actually sells.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://threaded-hope.com"
).replace(/\/$/, "");

export const SITE_KEYWORDS = [
  "handmade bags",
  "handmade zipper pouches",
  "handmade tote bags",
  "handmade keychains",
  "fabric accessories",
  "faith-based gifts",
  "Christian handmade gifts",
  "small batch handmade goods",
  "handmade gifts for her",
  "handmade shoulder bags",
  "Threaded Hope",
];
