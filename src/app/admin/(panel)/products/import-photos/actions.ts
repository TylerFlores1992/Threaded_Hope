"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import {
  fetchShopifyImageMap,
  uploadImagesFromUrls,
  normTitle,
} from "@/lib/shopify-import";

const BATCH = 5;

export type ImportProgress = {
  total: number;
  nextOffset: number;
  done: boolean;
  matched: number;
  updated: number;
  unmatched: string[];
};

/**
 * Import photos for a slice of products (Shopify → Blob → DB). Called in a loop
 * by the client so the whole catalog is covered without any single request
 * timing out. `onlyMissing` limits work to products with fewer than 2 photos.
 */
export async function importPhotosBatch(
  offset: number,
  onlyMissing: boolean,
): Promise<ImportProgress> {
  const prisma = getPrisma();
  const all = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, images: true },
  });
  const total = all.length;
  const slice = all.slice(offset, offset + BATCH);

  const map = await fetchShopifyImageMap();
  let matched = 0;
  let updated = 0;
  const unmatched: string[] = [];

  for (const p of slice) {
    const srcs = map.get(normTitle(p.name));
    if (!srcs) {
      unmatched.push(p.name);
      continue;
    }
    matched++;
    const count = Array.isArray(p.images) ? p.images.length : 0;
    if (onlyMissing && count >= 2) continue;

    const urls = await uploadImagesFromUrls(srcs, p.name);
    if (urls.length > 0) {
      await prisma.product.update({
        where: { id: p.id },
        data: { images: urls, image: urls[0] },
      });
      updated++;
    }
  }

  const nextOffset = offset + BATCH;
  const done = nextOffset >= total;
  if (done) {
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/admin/products");
  }

  return { total, nextOffset, done, matched, updated, unmatched };
}
