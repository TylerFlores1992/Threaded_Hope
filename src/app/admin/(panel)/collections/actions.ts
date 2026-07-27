"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";

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
  };
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
