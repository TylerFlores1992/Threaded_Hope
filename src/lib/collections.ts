import "server-only";
import { prisma } from "@/lib/db";
import {
  collections as staticCollections,
  type Collection,
} from "@/data/collections";

/**
 * Collections data-access layer — mirrors `catalog.ts`.
 *
 * When a database is configured, collections come from Postgres (managed in the
 * admin at /admin/collections). Otherwise everything falls back to the static
 * list in `src/data/collections.ts`, so the storefront works with zero config.
 * Every function returns the same `Collection` shape regardless of source.
 */

type Row = {
  slug: string;
  name: string;
  description: string;
  hue: number;
  featured: boolean;
  hidden: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  heroImage?: string | null;
  tileImage?: string | null;
};

function mapRow(r: Row): Collection {
  return {
    slug: r.slug,
    name: r.name,
    description: r.description,
    hue: r.hue,
    featured: r.featured,
    hidden: r.hidden,
    seoTitle: r.seoTitle ?? undefined,
    seoDescription: r.seoDescription ?? undefined,
    heroImage: r.heroImage ?? undefined,
    tileImage: r.tileImage ?? undefined,
  };
}

/** All collections including hidden ones, in display order (admin + lookups). */
export async function getAllCollections(): Promise<Collection[]> {
  if (!prisma) return staticCollections;
  const rows = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (rows.length === 0) return staticCollections;
  return rows.map(mapRow);
}

/** Only collections shown on the storefront (not hidden). */
export async function getVisibleCollections(): Promise<Collection[]> {
  return (await getAllCollections()).filter((c) => !c.hidden);
}

export async function getCollectionBySlug(
  slug: string,
  { includeHidden = false } = {},
): Promise<Collection | undefined> {
  const all = await getAllCollections();
  const found = all.find((c) => c.slug === slug);
  if (!found) return undefined;
  if (found.hidden && !includeHidden) return undefined;
  return found;
}

/** slug → { name, hue } for every collection (incl hidden), for product mapping. */
export async function getCollectionMap(): Promise<
  Map<string, { name: string; hue: number }>
> {
  const all = await getAllCollections();
  return new Map(all.map((c) => [c.slug, { name: c.name, hue: c.hue }]));
}
