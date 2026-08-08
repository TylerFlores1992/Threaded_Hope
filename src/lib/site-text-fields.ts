import { store } from "@/data/store";

/**
 * Editable site copy. Plain module (no server-only) so the admin client form and
 * server pages share it. Each field has a default taken from the current copy,
 * so nothing changes until it's edited; overrides live in the `Setting` table
 * under `text_<key>` and are read via `lib/site-text.ts`.
 *
 * To make another string editable: add a field here, then render it with
 * `text.<key>` on the page.
 */
export type TextField = {
  key: string;
  label: string;
  group: string;
  default: string;
  /** Render a textarea instead of a single-line input. */
  multiline?: boolean;
  help?: string;
};

export const SITE_TEXT_TAG = "site-text";
export const textSettingKey = (key: string) => `text_${key}`;

export const SITE_TEXT_FIELDS: TextField[] = [
  // ── Home: hero ──
  {
    key: "home_hero_badge",
    label: "Badge (small pill above the headline)",
    group: "Home — hero",
    default: "Handmade small-batch goods",
  },
  {
    key: "home_hero_heading",
    label: "Headline",
    group: "Home — hero",
    default: store.tagline,
    multiline: true,
  },
  {
    key: "home_hero_subtitle",
    label: "Sub-headline",
    group: "Home — hero",
    default: store.heroSubtitle,
    multiline: true,
  },
  {
    key: "home_hero_cta_primary",
    label: "Primary button",
    group: "Home — hero",
    default: "Shop all products",
  },
  {
    key: "home_hero_cta_secondary",
    label: "Secondary button",
    group: "Home — hero",
    default: "Our story",
  },

  // ── Home: sections ──
  {
    key: "home_collections_heading",
    label: "Collections heading",
    group: "Home — sections",
    default: "Shop by collection",
  },
  {
    key: "home_story_heading",
    label: "Story heading",
    group: "Home — sections",
    default: "Stitched with hope",
  },
  {
    key: "home_story_body_1",
    label: "Story paragraph 1",
    group: "Home — sections",
    default: `Every piece from ${store.name} begins as a bolt of fabric and a hopeful idea. We make in small batches, by hand, with care for the little details — because the everyday things you carry should feel special.`,
    multiline: true,
  },
  {
    key: "home_story_body_2",
    label: "Story paragraph 2",
    group: "Home — sections",
    default:
      "Faith and community are woven into everything we do. Thank you for being part of our story.",
    multiline: true,
  },
  {
    key: "home_story_cta",
    label: "Story button",
    group: "Home — sections",
    default: "Read our story",
  },
  {
    key: "newsletter_heading",
    label: "Newsletter heading",
    group: "Home — sections",
    default: "Join our community",
  },
  {
    key: "newsletter_pitch",
    label: "Newsletter blurb",
    group: "Home — sections",
    default: store.newsletterPitch,
    multiline: true,
  },

  // ── Our Story page ──
  {
    key: "story_title",
    label: "Page title",
    group: "Our Story page",
    default: "Our Story",
  },
  {
    key: "story_subtitle",
    label: "Page subtitle",
    group: "Our Story page",
    default:
      "Faith, family, and a love of handmade — woven into everything we make.",
    multiline: true,
  },
  {
    key: "story_body",
    label: "Story text",
    group: "Our Story page",
    help: "Blank lines separate paragraphs.",
    default: [
      "I started sewing in my season of waiting — waiting to grow our family, and waiting as we healed from the miscarriage of our twin babies.",
      "Our miscarriage happened a few weeks after the loss of my grandpa. It was a heavy time of grief, and I found myself spending a lot of time with my grandma. She shared that she had been leaning on her sewing and petit point as a way to help with her grief. She inspired me — and with a little push from my husband, I decided to get a sewing machine. And here we are. :)",
      "My hope is that this story can encourage anyone who's in a season of waiting. Whether you're waiting for a job, healing, a spouse, or something else — joy and peace can be found in the wait.",
    ].join("\n\n"),
    multiline: true,
  },
  {
    key: "story_verse_heading",
    label: "Verse section heading",
    group: "Our Story page",
    default: "The verse behind the name",
  },
  {
    key: "story_made_heading",
    label: "Closing section heading",
    group: "Our Story page",
    default: "Made with care, love & hope",
  },
  {
    key: "story_cta",
    label: "Closing button",
    group: "Our Story page",
    default: "Explore the shop",
  },

  // ── Shop page ──
  {
    key: "shop_heading",
    label: "Heading",
    group: "Shop page",
    default: "Shop All Products",
  },
  {
    key: "shop_subtitle",
    label: "Subtitle",
    group: "Shop page",
    default: "Handmade fabric accessories, made in small batches with care.",
    multiline: true,
  },

  // ── Gifting page ──
  {
    key: "gifting_heading",
    label: "Heading",
    group: "Gifting page",
    default: "Gift Guide",
  },
  {
    key: "gifting_subtitle",
    label: "Subtitle",
    group: "Gifting page",
    default:
      "Handmade with heart — thoughtful gifts for everyone on your list.",
    multiline: true,
  },
  {
    key: "gifting_cta_heading",
    label: "Closing heading",
    group: "Gifting page",
    default: "Need a hand choosing?",
  },
  {
    key: "gifting_cta_body",
    label: "Closing paragraph",
    group: "Gifting page",
    default:
      "We love helping you find the perfect gift. Reach out and we'll point you in the right direction.",
    multiline: true,
  },
  {
    key: "gifting_cta_button",
    label: "Closing button",
    group: "Gifting page",
    default: "Contact us",
  },
];

/** Ordered list of the distinct groups, for rendering the admin form. */
export const SITE_TEXT_GROUPS = Array.from(
  new Set(SITE_TEXT_FIELDS.map((f) => f.group)),
);

export type SiteText = Record<string, string>;

/** Defaults only — used as the fallback when no DB/override exists. */
export function defaultSiteText(): SiteText {
  return Object.fromEntries(SITE_TEXT_FIELDS.map((f) => [f.key, f.default]));
}
