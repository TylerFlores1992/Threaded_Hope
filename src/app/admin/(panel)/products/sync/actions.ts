"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Pull full product details from the live Shopify store — run server-side (on
 * Vercel, where the DB lives) in small batches driven by the client, so it works
 * from a phone with no local setup. Mirrors scripts/sync-shopify-details.mjs.
 *
 * Shopify's public products.json exposes availability but NOT stock counts, so
 * this syncs descriptions, in/out-of-stock, and weights only.
 */
const STORE = "threadedhope.myshopify.com";
const BATCH = 25;

const norm = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function htmlToText(html: string): string {
  if (!html) return "";
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|ul|ol|li|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ShopifyProduct = {
  title: string;
  body_html?: string;
  variants?: { title?: string; available?: boolean; grams?: number }[];
};

async function fetchShopify(): Promise<Map<string, ShopifyProduct>> {
  const byTitle = new Map<string, ShopifyProduct>();
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(
      `https://${STORE}/products.json?limit=250&page=${page}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Shopify fetch failed (${res.status})`);
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    const products = data.products ?? [];
    if (products.length === 0) break;
    for (const p of products) byTitle.set(norm(p.title), p);
    if (products.length < 250) break;
  }
  return byTitle;
}

export type SyncProgress = {
  total: number;
  nextOffset: number;
  done: boolean;
  updated: number;
  unmatched: string[];
};

export async function syncShopifyBatch(offset: number): Promise<SyncProgress> {
  const prisma = getPrisma();
  const all = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  const slice = all.slice(offset, offset + BATCH);
  const shopify = await fetchShopify();

  let updated = 0;
  const unmatched: string[] = [];

  for (const row of slice) {
    const sp = shopify.get(norm(row.name));
    if (!sp) {
      unmatched.push(row.name);
      continue;
    }

    const data: Prisma.ProductUpdateInput = {};

    const full = htmlToText(sp.body_html ?? "");
    if (full && full !== row.description) data.description = full;

    const variants = sp.variants ?? [];
    if (variants.length > 0) {
      const anyAvailable = variants.some((v) => v.available);
      const current =
        row.sizeStock && typeof row.sizeStock === "object"
          ? { ...(row.sizeStock as Record<string, number>) }
          : {};
      const next = { ...current };
      for (const v of variants) {
        const label = String(v.title ?? "").trim();
        if (!label || label.toLowerCase() === "default title") continue;
        if (!v.available) next[label] = 0;
        else if (next[label] === 0) delete next[label];
      }
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        data.sizeStock = next as Prisma.InputJsonValue;
      }
      if (row.inStock !== anyAvailable) data.inStock = anyAvailable;
    }

    const grams = variants.map((v) => v.grams ?? 0).find((g) => g > 0);
    if (grams) {
      const oz = Math.round((grams / 28.3495) * 10) / 10;
      if (row.weightOz !== oz) data.weightOz = oz;
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.product.update({ where: { id: row.id }, data });
    updated++;
  }

  const nextOffset = offset + BATCH;
  const done = nextOffset >= all.length;
  if (done) {
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/admin/products");
  }

  return { total: all.length, nextOffset, done, updated, unmatched };
}
