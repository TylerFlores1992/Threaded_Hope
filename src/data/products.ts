import { collections } from "./collections";

/**
 * Product seed data.
 * ── EDIT HERE ── to change the catalog. Each entry is a plain object; the
 * `slug` and placeholder `image` are derived automatically from the name +
 * collection, so you only need to fill in the fields below.
 *
 * Fields:
 *  - collection : slug from collections.ts
 *  - name       : display name
 *  - price      : US dollars
 *  - description: short blurb shown on cards & product page
 *  - variants   : optional selectable options (e.g. color / pattern)
 *  - inStock    : stock status (defaults to true)
 *  - featured   : show on the home page
 *  - createdAt  : ISO date, used for "newest" sorting
 */
export type Variant = {
  name: string; // e.g. "Color"
  options: string[]; // e.g. ["Sage", "Blush"]
};

export type ProductSeed = {
  collection: string;
  name: string;
  price: number;
  description: string;
  variants?: Variant[];
  inStock?: boolean;
  featured?: boolean;
  createdAt?: string;
};

export type Product = Required<Omit<ProductSeed, "variants" | "createdAt">> & {
  slug: string;
  variants: Variant[];
  createdAt: string;
  collectionName: string;
  hue: number;
};

const COLOR: Variant = {
  name: "Color",
  options: ["Sage", "Cream", "Dusty Blue", "Blush"],
};
const PATTERN: Variant = {
  name: "Pattern",
  options: ["Floral", "Gingham", "Solid", "Wildflower"],
};

// prettier-ignore
const seed: ProductSeed[] = [
  // ── Bags & Zipper Pouches ──
  { collection: "bags-pouches", name: "Everyday Canvas Tote", price: 38, description: "A sturdy, roomy tote for market runs and everyday hauling.", variants: [COLOR], featured: true },
  { collection: "bags-pouches", name: "Little Zipper Pouch", price: 12, description: "The perfect catch-all for cords, coins, and lip balm.", variants: [PATTERN] },
  { collection: "bags-pouches", name: "Boxed Cosmetic Bag", price: 22, description: "A wipe-clean lined pouch that stands open on the counter.", variants: [COLOR, PATTERN] },
  { collection: "bags-pouches", name: "Crossbody Sling Bag", price: 42, description: "Hands-free comfort with an adjustable strap and zip closure.", variants: [COLOR], featured: true },
  { collection: "bags-pouches", name: "Snack Bag Set", price: 16, description: "Reusable, washable snack bags in a set of three sizes.", variants: [PATTERN] },
  { collection: "bags-pouches", name: "Quilted Project Bag", price: 34, description: "Keep knitting or craft supplies tidy and portable.", variants: [PATTERN] },
  { collection: "bags-pouches", name: "Mini Coin Purse", price: 9, description: "A tiny snap purse that tucks into any pocket.", variants: [COLOR], inStock: false },

  // ── Faith-Based Items ──
  { collection: "faith-based", name: "Grace Scripture Pouch", price: 18, description: "A zip pouch embroidered with a gentle word of encouragement.", variants: [COLOR], featured: true },
  { collection: "faith-based", name: "Prayer Journal Sleeve", price: 24, description: "A padded cover to protect your journal and pen.", variants: [PATTERN] },
  { collection: "faith-based", name: "Hope Anchors Keychain", price: 10, description: "A little reminder to hold onto hope, wherever you go.", variants: [COLOR] },
  { collection: "faith-based", name: "Blessed Zipper Wristlet", price: 20, description: "Carry the essentials with a hopeful word stitched on.", variants: [COLOR, PATTERN] },
  { collection: "faith-based", name: "Faith Over Fear Pouch", price: 16, description: "A soft-lined pouch with a quiet, steadying message.", variants: [PATTERN] },
  { collection: "faith-based", name: "Cross Motif Coasters", price: 14, description: "A set of four quilted coasters with a subtle cross motif.", variants: [COLOR] },
  { collection: "faith-based", name: "Comfort & Joy Sachet", price: 8, description: "A lavender-scented sachet to bring calm to any drawer.", variants: [PATTERN] },

  // ── Boo-Boo Bags ──
  { collection: "boo-boo-bags", name: "Classic Boo-Boo Bag", price: 12, description: "Warm or cool comfort for little bumps and scrapes.", variants: [PATTERN], featured: true },
  { collection: "boo-boo-bags", name: "Rice-Filled Heating Pad", price: 22, description: "A larger pack for sore shoulders and cozy evenings.", variants: [COLOR] },
  { collection: "boo-boo-bags", name: "Eye Pillow", price: 15, description: "A weighted, scented pillow for headaches and rest.", variants: [PATTERN] },
  { collection: "boo-boo-bags", name: "Neck Wrap Comfort Pack", price: 26, description: "Contoured to drape gently around tired shoulders.", variants: [COLOR] },
  { collection: "boo-boo-bags", name: "Kids Character Boo-Boo Pack", price: 14, description: "A friendly-print pack that makes owies a little better.", variants: [PATTERN] },
  { collection: "boo-boo-bags", name: "Lavender Hand Warmers", price: 10, description: "Pocket-sized warmers for chilly mornings, set of two.", variants: [COLOR] },
  { collection: "boo-boo-bags", name: "Tummy Comfort Pack", price: 18, description: "Gentle warmth sized just right for little tummies.", variants: [PATTERN], inStock: false },

  // ── For the Fur Babies ──
  { collection: "fur-babies", name: "Reversible Dog Bandana", price: 12, description: "Two looks in one — snaps on easily for walks and photos.", variants: [PATTERN], featured: true },
  { collection: "fur-babies", name: "Catnip Comfort Mouse", price: 8, description: "A hand-stitched, catnip-filled toy your cat will adore.", variants: [COLOR] },
  { collection: "fur-babies", name: "Padded Collar Cover", price: 14, description: "A soft, washable slip-on to dress up any collar.", variants: [PATTERN] },
  { collection: "fur-babies", name: "Pet Travel Pouch", price: 20, description: "Keep treats, bags, and essentials tidy on the go.", variants: [COLOR] },
  { collection: "fur-babies", name: "Quilted Pet Blanket", price: 32, description: "A cozy, machine-washable blanket for crate or couch.", variants: [PATTERN] },
  { collection: "fur-babies", name: "Bow Tie Collar Charm", price: 9, description: "A dapper little bow tie that snaps onto the collar.", variants: [PATTERN] },

  // ── Kiddos ──
  { collection: "kiddos", name: "Kids Crayon Roll", price: 16, description: "Rolls up to keep crayons tidy and travel-ready.", variants: [PATTERN], featured: true },
  { collection: "kiddos", name: "Toddler Bib Set", price: 18, description: "Absorbent, snap-close bibs in a set of three.", variants: [COLOR] },
  { collection: "kiddos", name: "Busy Book Quiet Pages", price: 28, description: "A soft, interactive book for little hands and quiet time.", variants: [PATTERN] },
  { collection: "kiddos", name: "Kids Backpack Charm", price: 10, description: "A cheerful fabric charm to spot the right bag fast.", variants: [COLOR] },
  { collection: "kiddos", name: "Nap Mat Roll", price: 40, description: "A padded, roll-up mat with a built-in pillow and strap.", variants: [PATTERN] },
  { collection: "kiddos", name: "Fabric Baby Blocks", price: 22, description: "Soft, safe stacking blocks in gentle prints.", variants: [PATTERN] },

  // ── Wallet Zipper Keychains ──
  { collection: "wallet-keychains", name: "Wristlet Keychain Wallet", price: 16, description: "Cards, cash, and keys together on one handy wristlet.", variants: [PATTERN], featured: true },
  { collection: "wallet-keychains", name: "Card & Key Zip Fob", price: 12, description: "A slim zip fob that clips to any bag or belt loop.", variants: [COLOR] },
  { collection: "wallet-keychains", name: "ID Window Keychain", price: 14, description: "A clear window keeps your ID visible and handy.", variants: [PATTERN] },
  { collection: "wallet-keychains", name: "Double-Zip Keychain Pouch", price: 18, description: "Two compartments to sort cards from cash.", variants: [COLOR] },
  { collection: "wallet-keychains", name: "Mini Wristlet", price: 15, description: "The essentials-only wristlet for quick errands.", variants: [PATTERN] },
  { collection: "wallet-keychains", name: "Coin Zip Keyfob", price: 11, description: "A rounded zip fob just right for loose change.", variants: [COLOR] },

  // ── Keychains & Accessories ──
  { collection: "keychains-accessories", name: "Fabric Key Fob Wristlet", price: 9, description: "A padded wrist strap so keys are always within reach.", variants: [PATTERN], featured: true },
  { collection: "keychains-accessories", name: "Lanyard Badge Holder", price: 14, description: "A comfortable fabric lanyard with a swivel clip.", variants: [COLOR] },
  { collection: "keychains-accessories", name: "Scrunchie Set", price: 12, description: "Gentle-hold fabric scrunchies in a set of three.", variants: [PATTERN] },
  { collection: "keychains-accessories", name: "Luggage Tag", price: 10, description: "Spot your bag fast with a bold, wipe-clean tag.", variants: [PATTERN] },
  { collection: "keychains-accessories", name: "Mask Strap Extender", price: 8, description: "Takes the pressure off ears during long days.", variants: [COLOR] },
  { collection: "keychains-accessories", name: "Wristlet Strap Add-On", price: 9, description: "Turn any pouch into a wristlet with a quick clip.", variants: [COLOR] },

  // ── Kindle & Book Sleeves ──
  { collection: "book-sleeves", name: "Padded Kindle Sleeve", price: 24, description: "A snug, padded sleeve to protect your e-reader.", variants: [PATTERN], featured: true },
  { collection: "book-sleeves", name: "Paperback Book Sleeve", price: 20, description: "Slip your current read in and toss it in any bag.", variants: [COLOR] },
  { collection: "book-sleeves", name: "Hardcover Book Sleeve", price: 26, description: "Extra room and padding for larger hardbacks.", variants: [PATTERN] },
  { collection: "book-sleeves", name: "Bookmark & Sleeve Set", price: 28, description: "A matching padded sleeve and fabric bookmark.", variants: [PATTERN] },
  { collection: "book-sleeves", name: "Tablet Sleeve", price: 30, description: "Padded protection sized for most 10-inch tablets.", variants: [COLOR] },
  { collection: "book-sleeves", name: "Journal Sleeve", price: 22, description: "Keep your journal and pen tidy and protected.", variants: [PATTERN] },

  // ── Towel Shorts ──
  { collection: "towel-shorts", name: "Kids Towel Shorts", price: 26, description: "Soft, absorbent towel shorts for after the pool.", variants: [COLOR], featured: true },
  { collection: "towel-shorts", name: "Adult Towel Shorts", price: 34, description: "Cozy, quick-dry towel shorts for beach days.", variants: [COLOR] },
  { collection: "towel-shorts", name: "Toddler Towel Shorts", price: 22, description: "Easy on-and-off comfort for the littlest swimmers.", variants: [PATTERN] },
  { collection: "towel-shorts", name: "Hooded Towel Wrap", price: 38, description: "A snuggly hooded wrap to match the towel shorts.", variants: [COLOR] },
  { collection: "towel-shorts", name: "Beach Towel Set", price: 42, description: "Towel shorts paired with a matching drawstring bag.", variants: [PATTERN] },
  { collection: "towel-shorts", name: "Swim Cover Shorts", price: 30, description: "Breathable towel shorts that double as a cover-up.", variants: [COLOR], inStock: false },

  // ── Gifts for Parents ──
  { collection: "gifts-for-parents", name: "New Mom Comfort Set", price: 45, description: "A thoughtful bundle of pouch, sachet, and eye pillow.", variants: [PATTERN], featured: true },
  { collection: "gifts-for-parents", name: "Dad's Everyday Organizer", price: 32, description: "A rugged catch-all pouch for the essentials.", variants: [COLOR] },
  { collection: "gifts-for-parents", name: "Coffee & Calm Gift Pouch", price: 28, description: "A cozy pouch paired with a lavender sachet.", variants: [PATTERN] },
  { collection: "gifts-for-parents", name: "Keepsake Memory Pouch", price: 24, description: "A soft-lined pouch for keeping treasures safe.", variants: [COLOR] },
  { collection: "gifts-for-parents", name: "Grandparent Photo Sleeve", price: 20, description: "A padded sleeve to protect cherished photos.", variants: [PATTERN] },
  { collection: "gifts-for-parents", name: "Self-Care Bundle", price: 40, description: "Eye pillow, sachet, and neck wrap for a restful gift.", variants: [COLOR] },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const collectionMap = new Map(collections.map((c) => [c.slug, c]));

// Deterministic "createdAt" spread so "newest" sorting is stable without a build clock.
const BASE = Date.UTC(2024, 0, 1);

export const products: Product[] = seed.map((s, i) => {
  const collection = collectionMap.get(s.collection);
  if (!collection) {
    throw new Error(
      `Product "${s.name}" references unknown collection "${s.collection}"`,
    );
  }
  return {
    ...s,
    slug: slugify(s.name),
    variants: s.variants ?? [],
    inStock: s.inStock ?? true,
    featured: s.featured ?? false,
    createdAt: s.createdAt ?? new Date(BASE + i * 86_400_000).toISOString(),
    collectionName: collection.name,
    hue: collection.hue,
  };
});

export const productBySlug = (slug: string) =>
  products.find((p) => p.slug === slug);

export const productsByCollection = (collectionSlug: string) =>
  products.filter((p) => p.collection === collectionSlug);

export const featuredProducts = products.filter((p) => p.featured);

export const relatedProducts = (product: Product, limit = 4) =>
  products
    .filter((p) => p.collection === product.collection && p.slug !== product.slug)
    .slice(0, limit);
