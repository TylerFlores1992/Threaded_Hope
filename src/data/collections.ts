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
  hidden?: boolean;
  /** Search-engine overrides set in admin; blank falls back to name/description. */
  seoTitle?: string;
  seoDescription?: string; // hidden from the storefront (still valid for existing products)
};

export const collections: Collection[] = [
  {
    slug: "bags-pouches",
    name: "Bags",
    description:
      "Roomy totes and everyday bags, handmade to carry your essentials in style.",
    hue: 145,
    featured: true,
  },
  {
    slug: "zipper-pouches",
    name: "Zipper Pouches",
    description:
      "Handy lined zipper pouches for makeup, cords, coins, and little catch-alls.",
    hue: 170,
    featured: true,
  },
  {
    slug: "faith-based",
    name: "Faith Based",
    description:
      "Gentle reminders of hope and grace, stitched to carry with you through the day.",
    hue: 210,
    featured: true,
  },
  {
    slug: "boo-boo-bags",
    name: "Boo Boo Bags",
    description:
      "Warm-or-cool comfort packs for little bumps, sore muscles, and cozy evenings.",
    hue: 12,
    featured: true,
  },
  {
    slug: "fur-babies",
    name: "For the Fur Babies",
    description:
      "Handmade bandanas and accessories for the four-legged members of the family.",
    hue: 32,
    featured: true,
  },
  {
    slug: "kiddos",
    name: "Kiddos",
    description:
      "Playful, practical pieces made just for the little ones.",
    hue: 285,
  },
  {
    slug: "wallet-keychains",
    name: "Wallet Zipper Keychains",
    description:
      "Compact wristlet keychain wallets to keep cards and keys together.",
    hue: 255,
  },
  {
    slug: "keychains",
    name: "Keychains & Accessories",
    description:
      "Handmade keychains, wristlets, and little accessories to finish your everyday carry.",
    hue: 48,
    featured: true,
  },
  {
    slug: "book-sleeves",
    name: "Kindle & Book Sleeves",
    description:
      "Padded sleeves to protect your Kindle or paperback on the go.",
    hue: 300,
  },
  {
    slug: "towel-shorts",
    name: "Towel Shorts",
    description:
      "Soft, absorbent towel shorts for after the pool, beach, or bath.",
    hue: 195,
  },
  {
    slug: "for-the-parents",
    name: "For the Parents",
    description:
      "Thoughtful handmade pieces made with parents in mind.",
    hue: 330,
  },
  {
    slug: "christmas",
    name: "Christmas Collection",
    description:
      "Handmade holiday goods to gift and treasure through the Christmas season.",
    hue: 358,
  },
  {
    slug: "easter",
    name: "Easter",
    description:
      "Springtime handmade goods for baskets and celebrations.",
    hue: 95,
  },
  {
    slug: "gift-ideas",
    name: "Gift Ideas",
    description:
      "Ready-to-give handmade favorites — perfect for anyone on your list.",
    hue: 115,
  },
];

export const collectionBySlug = (slug: string) =>
  collections.find((c) => c.slug === slug);
