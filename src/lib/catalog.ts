import "server-only";
import { prisma } from "@/lib/db";
import {
  products as staticProducts,
  productBySlug as staticProductBySlug,
  productsByCollection as staticByCollection,
  featuredProducts as staticFeatured,
  relatedProducts as staticRelated,
  type Product,
  type Variant,
} from "@/data/products";
import { getCollectionMap } from "@/lib/collections";
import { computeInStock } from "@/lib/stock";

/**
 * Catalog data-access layer.
 *
 * When a database is configured, products come from Postgres (managed in the
 * admin). Otherwise everything falls back to the static seed in
 * `src/data/products.ts`, so the storefront works with zero configuration and
 * the site keeps building/deploying during the migration.
 *
 * Every function returns the SAME `Product` shape regardless of source, so
 * storefront components don't care where the data came from.
 */

type CollectionMap = Map<string, { name: string; hue: number }>;

/**
 * Only "active" products reach the storefront. Draft and archived products stay
 * visible in admin but are hidden from shoppers, search, sitemaps and feeds.
 * Rows created before the status column default to active.
 */
const LIVE = { status: "active" } as const;

/** Manual position of a product within a collection; missing sorts to the end. */
function manualPosition(order: unknown, slug: string): number {
  if (!order || typeof order !== "object") return Number.MAX_SAFE_INTEGER;
  const v = (order as Record<string, unknown>)[slug];
  return typeof v === "number" ? v : Number.MAX_SAFE_INTEGER;
}

type ProductRow = {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  collectionSlug: string;
  collections?: unknown;
  image: string | null;
  images?: unknown;
  variants: unknown;
  sizeStock?: unknown;
  optionStock?: unknown;
  featured: boolean;
  inStock: boolean;
  createdAt: Date;
};

function mapRow(row: ProductRow, collectionMap: CollectionMap): Product {
  const collection = collectionMap.get(row.collectionSlug);
  // Fall back to the primary slug when the collections list is empty (e.g. rows
  // seeded before multi-collection support, or not yet backfilled).
  const stored = Array.isArray(row.collections)
    ? (row.collections as string[])
    : [];
  const collections =
    stored.length > 0
      ? Array.from(new Set([row.collectionSlug, ...stored]))
      : [row.collectionSlug];
  const variants = (Array.isArray(row.variants) ? row.variants : []) as Variant[];
  const sizeStock =
    row.sizeStock && typeof row.sizeStock === "object"
      ? (row.sizeStock as Record<string, number>)
      : {};
  const optionStock =
    row.optionStock && typeof row.optionStock === "object"
      ? (row.optionStock as Record<string, Record<string, number>>)
      : {};
  return {
    collection: row.collectionSlug,
    collections,
    name: row.name,
    price: row.priceCents / 100,
    description: row.description,
    variants,
    sizeStock,
    optionStock,
    inStock: computeInStock(
      { variants, sizeStock, optionStock, inStock: row.inStock },
      row.inStock,
    ),
    featured: row.featured,
    slug: row.slug,
    createdAt: row.createdAt.toISOString(),
    collectionName: collection?.name ?? row.collectionSlug,
    hue: collection?.hue ?? 145,
    image: row.image ?? undefined,
    images: (() => {
      const list = Array.isArray(row.images)
        ? (row.images as unknown[]).filter(
            (u): u is string => typeof u === "string" && u.length > 0,
          )
        : [];
      // Keep the primary first; fall back to the single image column.
      if (list.length > 0) return list;
      return row.image ? [row.image] : [];
    })(),
  };
}

export async function getProducts(): Promise<Product[]> {
  if (!prisma) return staticProducts;
  const rows = await prisma.product.findMany({
    where: LIVE,
    orderBy: { createdAt: "asc" },
  });
  // Safety: never render an empty storefront if the DB exists but isn't seeded.
  if (rows.length === 0) return staticProducts;
  const collMap = await getCollectionMap();
  return rows.map((r) => mapRow(r, collMap));
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  if (!prisma) return staticProductBySlug(slug);
  const row = await prisma.product.findFirst({ where: { slug, ...LIVE } });
  return row ? mapRow(row, await getCollectionMap()) : undefined;
}

/** Units sold per product slug, for "best selling" collection ordering. */
async function unitsSoldBySlug(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!prisma) return counts;
  const orders = await prisma.order.findMany({ select: { items: true } });
  for (const o of orders) {
    const items = (Array.isArray(o.items) ? o.items : []) as {
      slug?: string | null;
      quantity?: number;
    }[];
    for (const it of items) {
      if (!it.slug) continue;
      counts.set(it.slug, (counts.get(it.slug) ?? 0) + (it.quantity ?? 1));
    }
  }
  return counts;
}

export async function getProductsByCollection(
  collectionSlug: string,
): Promise<Product[]> {
  if (!prisma) return staticByCollection(collectionSlug);
  const [rows, collection] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...LIVE,
        OR: [
          { collectionSlug },
          { collections: { array_contains: collectionSlug } },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.collection.findUnique({ where: { slug: collectionSlug } }),
  ]);

  // Collection sort mode (set in admin). "manual" honours the drag-and-drop
  // order stored per product in `collectionOrder`.
  const mode = collection?.sortMode ?? "manual";
  const sold = mode === "best-selling" ? await unitsSoldBySlug() : null;
  const sorted = [...rows].sort((a, b) => {
    switch (mode) {
      case "best-selling":
        return (sold?.get(b.slug) ?? 0) - (sold?.get(a.slug) ?? 0);
      case "alpha-asc":
        return a.name.localeCompare(b.name);
      case "alpha-desc":
        return b.name.localeCompare(a.name);
      case "price-asc":
        return a.priceCents - b.priceCents;
      case "price-desc":
        return b.priceCents - a.priceCents;
      case "date-desc":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "date-asc":
        return a.createdAt.getTime() - b.createdAt.getTime();
      default: {
        const pa = manualPosition(a.collectionOrder, collectionSlug);
        const pb = manualPosition(b.collectionOrder, collectionSlug);
        // Untouched products keep their original order behind the arranged ones.
        return pa - pb || a.createdAt.getTime() - b.createdAt.getTime();
      }
    }
  });

  const collMap = await getCollectionMap();
  return sorted.map((r) => mapRow(r, collMap));
}

export async function getFeaturedProducts(): Promise<Product[]> {
  if (!prisma) return staticFeatured;
  const rows = await prisma.product.findMany({
    where: { featured: true, ...LIVE },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    // If nothing is flagged featured (or DB unseeded), fall back gracefully.
    const total = await prisma.product.count();
    if (total === 0) return staticFeatured;
  }
  const collMap = await getCollectionMap();
  return rows.map((r) => mapRow(r, collMap));
}

/**
 * Distinct product image URLs per collection slug (in-stock products first).
 * Lets the home page hand out a *different* real photo to each spot — the hero
 * collage and every collection tile — so no image repeats on the page.
 */
export async function getCollectionImageOptions(): Promise<
  Record<string, string[]>
> {
  const all = await getProducts();
  const ordered = [...all].sort((a, b) => Number(b.inStock) - Number(a.inStock));
  const byCollection: Record<string, string[]> = {};
  for (const p of ordered) {
    if (!p.image) continue;
    for (const slug of p.collections) {
      const list = (byCollection[slug] ??= []);
      if (!list.includes(p.image)) list.push(p.image);
    }
  }
  return byCollection;
}

export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  if (!prisma) return staticRelated(product, limit);
  const rows = await prisma.product.findMany({
    where: {
      slug: { not: product.slug },
      ...LIVE,
      OR: [
        { collectionSlug: product.collection },
        { collections: { array_contains: product.collection } },
      ],
    },
    take: limit,
    orderBy: [{ inStock: "desc" }, { createdAt: "asc" }], // in-stock first
  });
  const collMap = await getCollectionMap();
  return rows.map((r) => mapRow(r, collMap));
}
