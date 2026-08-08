import "server-only";
import { unstable_cache } from "next/cache";
import { getSetting } from "@/lib/settings";
import { GUIDE_ROW } from "@/lib/gifting-rows";

/**
 * The gift guides — the rows of products down the Gifting page.
 *
 * Guides are *placed instances*, the same shape the home page's sections use: a
 * list you add to, remove from and reorder, rather than three fixed slots. Each
 * carries its own heading and blurb, because with a variable number of guides
 * there's nowhere fixed for Site text to keep them.
 *
 * Each guide picks its products one of three ways:
 *  - `collection` — everything in a collection, so it keeps itself up to date
 *  - `price`      — everything at or under a price ("Under $15")
 *  - `products`   — a hand-picked list, in the order chosen
 *
 * Stored as one JSON blob in `Setting`, edited at /admin/gifts.
 */
export const GIFTING_KEY = "gifting_config";
export const GIFTING_TAG = "gifting-config";

export type GuideSource = "collection" | "price" | "products";

export type GiftGuide = {
  /** Stable id, so React keys and reordering survive an edit. */
  key: string;
  heading: string;
  blurb: string;
  source: GuideSource;
  /** Collection slug, when source is "collection". */
  collection?: string;
  /** Dollar ceiling, when source is "price". */
  maxPrice?: number;
  /** Product slugs in display order, when source is "products". */
  slugs?: string[];
  /** How many products to show. Six fills a row on a wide screen. */
  limit: number;
};

export type GiftingConfig = { guides: GiftGuide[] };

export { GUIDE_ROW, rowLimit } from "@/lib/gifting-rows";

const SOURCES: GuideSource[] = ["collection", "price", "products"];
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * The three guides as the page shipped, used until the guides are saved once.
 *
 * Their wording used to be Site text fields (`text_gifting_guide*`), which have
 * been removed now that a guide carries its own. Any value saved back then is
 * read straight from the setting rows here, so a shop that renamed a guide
 * doesn't lose the name the first time this page loads — after one save the
 * stored guides are the whole truth and these keys go unread.
 */
async function legacyText(key: string, fallback: string): Promise<string> {
  const stored = await getSetting(`text_${key}`);
  return stored?.trim() ? stored : fallback;
}

async function defaultGuides(): Promise<GiftGuide[]> {
  const [h1, b1, max1, h2, b2, h3, b3] = await Promise.all([
    legacyText("gifting_guide1_heading", "Under $15"),
    legacyText(
      "gifting_guide1_blurb",
      "Little treasures that make wonderful stocking stuffers.",
    ),
    legacyText("gifting_guide1_max", "15"),
    legacyText("gifting_guide2_heading", "For the New Parent"),
    legacyText(
      "gifting_guide2_blurb",
      "Thoughtful comfort for the moms and dads who do it all.",
    ),
    legacyText("gifting_guide3_heading", "For the Pet Lover"),
    legacyText("gifting_guide3_blurb", "Because the fur babies deserve gifts too."),
  ]);

  return [
    {
      key: "budget",
      heading: h1,
      blurb: b1,
      source: "price",
      maxPrice: Number(max1) || 15,
      limit: GUIDE_ROW,
    },
    {
      key: "parents",
      heading: h2,
      blurb: b2,
      source: "collection",
      collection: "for-the-parents",
      limit: GUIDE_ROW,
    },
    {
      key: "pets",
      heading: h3,
      blurb: b3,
      source: "collection",
      collection: "fur-babies",
      limit: GUIDE_ROW,
    },
  ];
}

/** Coerce one stored guide, filling anything malformed with something usable. */
function parseGuide(raw: unknown, i: number): GiftGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const limit = Number(g.limit);
  const maxPrice = Number(g.maxPrice);
  return {
    key: str(g.key) || `guide-${i}`,
    heading: str(g.heading),
    blurb: str(g.blurb),
    source: SOURCES.includes(g.source as GuideSource)
      ? (g.source as GuideSource)
      : "collection",
    collection: str(g.collection) || undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    slugs: Array.isArray(g.slugs)
      ? g.slugs.filter((s): s is string => typeof s === "string")
      : undefined,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 24) : GUIDE_ROW,
  };
}

/** null means "nothing valid stored", which is what selects the defaults. */
export function parseGifting(raw: string | null): GiftingConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { guides?: unknown };
    if (!Array.isArray(parsed.guides)) return null;
    // An empty list is a legitimate choice — a page with no guides at all.
    return {
      guides: parsed.guides
        .map(parseGuide)
        .filter((g): g is GiftGuide => g !== null),
    };
  } catch {
    return null;
  }
}

const cachedSetting = unstable_cache(
  async () => getSetting(GIFTING_KEY),
  ["gifting-config"],
  { tags: [GIFTING_TAG], revalidate: 3600 },
);

export async function getGiftingConfig(): Promise<GiftingConfig> {
  return parseGifting(await cachedSetting()) ?? { guides: await defaultGuides() };
}
