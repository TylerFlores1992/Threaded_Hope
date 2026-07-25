/**
 * Collections (product categories).
 * ── EDIT HERE ── to rename, reorder, or re-describe collections.
 * `slug` is used in URLs (/collections/[slug]) and to link products to a collection.
 * `hue` drives the accent color of the generated placeholder images.
 */
export type Collection = {
  slug: string;
  name: string;
  description: string;
  hue: number; // 0–360, used by the SVG placeholder generator
  featured?: boolean;
};

export const collections: Collection[] = [
  {
    slug: "bags-pouches",
    name: "Bags & Zipper Pouches",
    description:
      "Roomy totes and handy zipper pouches to carry your everyday essentials in style.",
    hue: 145,
    featured: true,
  },
  {
    slug: "faith-based",
    name: "Faith-Based Items",
    description:
      "Gentle reminders of hope and grace, stitched to carry with you through the day.",
    hue: 210,
    featured: true,
  },
  {
    slug: "boo-boo-bags",
    name: "Boo-Boo Bags",
    description:
      "Warm-or-cool comfort packs for little bumps, sore muscles, and cozy evenings.",
    hue: 12,
    featured: true,
  },
  {
    slug: "fur-babies",
    name: "For the Fur Babies",
    description:
      "Handmade accessories for the four-legged members of the family.",
    hue: 32,
    featured: true,
  },
  {
    slug: "kiddos",
    name: "Kiddos",
    description: "Playful, practical, and durable pieces made just for the little ones.",
    hue: 285,
  },
  {
    slug: "wallet-keychains",
    name: "Wallet Zipper Keychains",
    description:
      "Keep cards and keys together with a compact wristlet keychain wallet.",
    hue: 175,
  },
  {
    slug: "keychains-accessories",
    name: "Keychains & Accessories",
    description: "The finishing touches — key fobs, wristlets, and little extras.",
    hue: 50,
  },
  {
    slug: "book-sleeves",
    name: "Kindle & Book Sleeves",
    description:
      "Padded sleeves to protect your favorite reads and e-readers on the go.",
    hue: 250,
  },
  {
    slug: "towel-shorts",
    name: "Towel Shorts",
    description: "Soft, absorbent towel shorts — perfect after the pool or the beach.",
    hue: 195,
  },
  {
    slug: "gifts-for-parents",
    name: "Gifts for Parents",
    description: "Thoughtful, handmade gifts for the moms and dads who do it all.",
    hue: 330,
  },
];

export const collectionBySlug = (slug: string) =>
  collections.find((c) => c.slug === slug);
