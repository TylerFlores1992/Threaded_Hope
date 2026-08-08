import "server-only";
import { unstable_cache } from "next/cache";
import { getSetting } from "@/lib/settings";

/**
 * Which collections the Gifting page draws from. Stored as one JSON blob in the
 * `Setting` table and edited at /admin/collections.
 *
 * The wording of the page lives in Site text; this is only the *sourcing* —
 * which collections tile across the top, and which one each of the two
 * collection-driven guides pulls its products from. The "Under $X" guide stays
 * price-driven: it's the only one answering "what can I afford", which is the
 * most common gift question, and turning it into another collection picker
 * would lose that.
 */
export const GIFTING_KEY = "gifting_config";
export const GIFTING_TAG = "gifting-config";

export type GiftingConfig = {
  /** Collection slugs shown as tiles, in order. */
  tiles: string[];
  /** Collection slug behind the second guide. */
  guide2: string;
  /** Collection slug behind the third guide. */
  guide3: string;
};

/** The page as it shipped, used until someone changes it. */
export const DEFAULT_GIFTING: GiftingConfig = {
  tiles: ["for-the-parents", "faith-based", "fur-babies", "kiddos"],
  guide2: "for-the-parents",
  guide3: "fur-babies",
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

/** Merge a stored blob over the defaults, ignoring anything malformed. */
export function parseGifting(raw: string | null): GiftingConfig {
  if (!raw) return DEFAULT_GIFTING;
  try {
    const parsed = JSON.parse(raw) as Partial<GiftingConfig>;
    const tiles = strings(parsed.tiles);
    return {
      // An empty selection means "show none", which is a legitimate choice —
      // only a missing key falls back to the default.
      tiles: Array.isArray(parsed.tiles) ? tiles : DEFAULT_GIFTING.tiles,
      guide2:
        typeof parsed.guide2 === "string" ? parsed.guide2 : DEFAULT_GIFTING.guide2,
      guide3:
        typeof parsed.guide3 === "string" ? parsed.guide3 : DEFAULT_GIFTING.guide3,
    };
  } catch {
    return DEFAULT_GIFTING;
  }
}

export const getGiftingConfig = unstable_cache(
  async (): Promise<GiftingConfig> => parseGifting(await getSetting(GIFTING_KEY)),
  ["gifting-config"],
  { tags: [GIFTING_TAG], revalidate: 3600 },
);
