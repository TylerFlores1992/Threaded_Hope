"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { GIFTING_KEY, GIFTING_TAG } from "@/lib/gifting";
import { SORT_IDS } from "@/lib/collection-sort";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function revalidateAll() {
  // Nav/footer live in the layout; storefront lists depend on collections too.
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/gifting");
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/admin/collections");
}

type Parsed = {
  name: string;
  description: string;
  hue: number;
  featured: boolean;
  hidden: boolean;
  sortMode: string;
  seoTitle: string | null;
  seoDescription: string | null;
  heroImage: string | null;
  tileImage: string | null;
};


function parseForm(formData: FormData): Parsed {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  const description = String(formData.get("description") ?? "").trim();
  const hueRaw = Number(formData.get("hue") ?? 145);
  const hue = Number.isFinite(hueRaw) ? Math.max(0, Math.min(360, Math.round(hueRaw))) : 145;
  return {
    name,
    description,
    hue,
    featured: formData.get("featured") === "on",
    hidden: formData.get("hidden") === "on",
    sortMode: (() => {
      const m = String(formData.get("sortMode") ?? "manual").trim();
      return SORT_IDS.has(m) ? m : "manual";
    })(),
    seoTitle: String(formData.get("seoTitle") ?? "").trim() || null,
    seoDescription: String(formData.get("seoDescription") ?? "").trim() || null,
    heroImage: String(formData.get("heroImage") ?? "").trim() || null,
    tileImage: String(formData.get("tileImage") ?? "").trim() || null,
  };
}

/**
 * Save a manual product arrangement for one collection. Each product stores its
 * own position map ({slug: index}) so a product can sit differently in each
 * collection it belongs to.
 */
export async function saveCollectionOrder(
  collectionSlug: string,
  productIds: string[],
): Promise<void> {
  const prisma = getPrisma();
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, collectionOrder: true },
  });
  const existing = new Map(rows.map((r) => [r.id, r.collectionOrder]));

  await prisma.$transaction(
    productIds.map((id, index) => {
      const current = existing.get(id);
      const order =
        current && typeof current === "object"
          ? { ...(current as Record<string, number>) }
          : {};
      order[collectionSlug] = index;
      return prisma.product.update({
        where: { id },
        data: { collectionOrder: order },
      });
    }),
  );

  revalidatePath(`/collections/${collectionSlug}`);
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/admin/collections");
}

export async function createCollection(formData: FormData): Promise<void> {
  const prisma = getPrisma();
  const data = parseForm(formData);

  const base = slugify(data.name) || "collection";
  let slug = base;
  let n = 1;
  while (await prisma.collection.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }
  const max = await prisma.collection.aggregate({ _max: { sortOrder: true } });

  await prisma.collection.create({
    data: { ...data, slug, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidateAll();
  redirect("/admin/collections");
}

export async function updateCollection(
  id: string,
  formData: FormData,
): Promise<void> {
  const prisma = getPrisma();
  const data = parseForm(formData);
  await prisma.collection.update({ where: { id }, data });
  revalidateAll();
  redirect("/admin/collections");
}

/** Toggle a collection's hidden state (quick action from the list). */
export async function setCollectionHidden(
  id: string,
  hidden: boolean,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.collection.update({ where: { id }, data: { hidden } });
  revalidateAll();
}

/**
 * Delete a collection. Blocked while products still reference it (by primary
 * slug or membership) — the admin should reassign or hide it instead.
 */
export async function deleteCollection(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const prisma = getPrisma();
  const col = await prisma.collection.findUnique({ where: { id } });
  if (!col) return { ok: false, error: "Collection not found." };

  const inUse = await prisma.product.count({
    where: {
      OR: [
        { collectionSlug: col.slug },
        { collections: { array_contains: col.slug } },
      ],
    },
  });
  if (inUse > 0) {
    return {
      ok: false,
      error: `${inUse} product${inUse === 1 ? "" : "s"} still use “${col.name}”. Reassign or hide it instead.`,
    };
  }

  await prisma.collection.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

/**
 * Save the order collections appear in — the home page grid and the
 * collections index both read `sortOrder`, so this is what "reorganize the
 * home page collections" means in practice.
 */
export async function saveCollectionOrdering(ids: string[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.collection.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidateAll();
}

/**
 * Save which collections the Gifting page uses. Slugs aren't validated against
 * the collection list here — a collection can be renamed or removed later, and
 * the page already skips a guide that ends up with no products.
 */
export async function saveGiftingConfig(config: {
  guide2: string;
  guide3: string;
}): Promise<void> {
  await setSetting(
    GIFTING_KEY,
    JSON.stringify({
      guide2: String(config.guide2 ?? ""),
      guide3: String(config.guide3 ?? ""),
    }),
  );
  revalidateTag(GIFTING_TAG, "max");
  revalidatePath("/gifting");
  revalidatePath("/admin/collections");
}
