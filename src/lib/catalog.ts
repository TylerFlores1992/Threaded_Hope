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
import { collections } from "@/data/collections";

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

const collectionMap = new Map(collections.map((c) => [c.slug, c]));

type ProductRow = {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  collectionSlug: string;
  collections?: unknown;
  image: string | null;
  variants: unknown;
  featured: boolean;
  inStock: boolean;
  createdAt: Date;
};

function mapRow(row: ProductRow): Product {
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
  return {
    collection: row.collectionSlug,
    collections,
    name: row.name,
    price: row.priceCents / 100,
    description: row.description,
    variants: (Array.isArray(row.variants) ? row.variants : []) as Variant[],
    inStock: row.inStock,
    featured: row.featured,
    slug: row.slug,
    createdAt: row.createdAt.toISOString(),
    collectionName: collection?.name ?? row.collectionSlug,
    hue: collection?.hue ?? 145,
    image: row.image ?? undefined,
  };
}

export async function getProducts(): Promise<Product[]> {
  if (!prisma) return staticProducts;
  const rows = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  // Safety: never render an empty storefront if the DB exists but isn't seeded.
  if (rows.length === 0) return staticProducts;
  return rows.map(mapRow);
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  if (!prisma) return staticProductBySlug(slug);
  const row = await prisma.product.findUnique({ where: { slug } });
  return row ? mapRow(row) : undefined;
}

export async function getProductsByCollection(
  collectionSlug: string,
): Promise<Product[]> {
  if (!prisma) return staticByCollection(collectionSlug);
  const rows = await prisma.product.findMany({
    where: {
      OR: [
        { collectionSlug },
        { collections: { array_contains: collectionSlug } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapRow);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  if (!prisma) return staticFeatured;
  const rows = await prisma.product.findMany({
    where: { featured: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    // If nothing is flagged featured (or DB unseeded), fall back gracefully.
    const total = await prisma.product.count();
    if (total === 0) return staticFeatured;
  }
  return rows.map(mapRow);
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
      OR: [
        { collectionSlug: product.collection },
        { collections: { array_contains: product.collection } },
      ],
    },
    take: limit,
    orderBy: [{ inStock: "desc" }, { createdAt: "asc" }], // in-stock first
  });
  return rows.map(mapRow);
}
