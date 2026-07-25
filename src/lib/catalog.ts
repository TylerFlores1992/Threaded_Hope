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
  image: string | null;
  variants: unknown;
  featured: boolean;
  inStock: boolean;
  createdAt: Date;
};

function mapRow(row: ProductRow): Product {
  const collection = collectionMap.get(row.collectionSlug);
  return {
    collection: row.collectionSlug,
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
    where: { collectionSlug },
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

export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  if (!prisma) return staticRelated(product, limit);
  const rows = await prisma.product.findMany({
    where: { collectionSlug: product.collection, slug: { not: product.slug } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapRow);
}
