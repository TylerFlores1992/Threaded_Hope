"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  isShopifyApiConfigured,
  fetchShopifyProducts,
  type ShopifyAdminProduct,
} from "@/lib/shopify";
import { sizeAxisOf, optionAxesOf } from "@/lib/stock";
import type { Variant } from "@/data/products";

/**
 * Pull product details from the live Shopify store, in small batches driven by
 * the client so it works from a phone with no local setup.
 *
 * Two sources, picked automatically:
 *  - Admin API (when SHOPIFY_CLIENT_ID/SECRET are set) — includes REAL stock
 *    counts, product type, vendor and status.
 *  - Public products.json — availability only; Shopify never exposes counts
 *    there. Kept as a fallback so the page still works without credentials.
 */
const STORE = process.env.SHOPIFY_STORE_DOMAIN || "threadedhope.myshopify.com";
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

const DEFAULT_TITLE = "default title";

/** Public storefront JSON — the no-credentials fallback. */
type PublicProduct = {
  title: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  variants?: { title?: string; available?: boolean; grams?: number }[];
};

async function fetchPublic(): Promise<ShopifyAdminProduct[]> {
  const out: ShopifyAdminProduct[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(
      `https://${STORE}/products.json?limit=250&page=${page}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Shopify fetch failed (${res.status})`);
    const data = (await res.json()) as { products?: PublicProduct[] };
    const products = data.products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      out.push({
        title: p.title,
        handle: "",
        descriptionHtml: p.body_html ?? "",
        productType: p.product_type ?? "",
        vendor: p.vendor ?? "",
        status: "ACTIVE",
        variants: (p.variants ?? []).map((v) => ({
          title: String(v.title ?? "").trim(),
          inventoryQuantity: null, // never exposed publicly
          availableForSale: Boolean(v.available),
          weightOz: v.grams ? Math.round((v.grams / 28.3495) * 10) / 10 : null,
        })),
      });
    }
    if (products.length < 250) break;
  }
  return out;
}

export type SyncProgress = {
  total: number;
  nextOffset: number;
  done: boolean;
  updated: number;
  unmatched: string[];
  /** True when real stock counts were available (Admin API connected). */
  withCounts: boolean;
};

export async function syncShopifyBatch(offset: number): Promise<SyncProgress> {
  const prisma = getPrisma();
  const useApi = isShopifyApiConfigured();

  const all = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  const slice = all.slice(offset, offset + BATCH);

  const source = useApi ? await fetchShopifyProducts() : await fetchPublic();
  const byTitle = new Map(source.map((p) => [norm(p.title), p]));

  let updated = 0;
  const unmatched: string[] = [];

  for (const row of slice) {
    const sp = byTitle.get(norm(row.name));
    if (!sp) {
      unmatched.push(row.name);
      continue;
    }

    const data: Prisma.ProductUpdateInput = {};

    const full = htmlToText(sp.descriptionHtml);
    if (full && full !== row.description) data.description = full;
    if (sp.productType && sp.productType !== row.productType) {
      data.productType = sp.productType;
    }
    if (sp.vendor && sp.vendor !== row.vendor) data.vendor = sp.vendor;
    // Shopify's status only counts when the API gave us a real one.
    if (useApi) {
      const status = sp.status.toLowerCase();
      if (
        ["active", "draft", "archived"].includes(status) &&
        status !== row.status
      ) {
        data.status = status;
      }
    }

    const variants = sp.variants;
    if (variants.length > 0) {
      const ourVariants = (
        Array.isArray(row.variants) ? row.variants : []
      ) as Variant[];
      const axis = sizeAxisOf({ variants: ourVariants });
      const optionAxes = optionAxesOf({ variants: ourVariants });

      const sizeStock =
        row.sizeStock && typeof row.sizeStock === "object"
          ? { ...(row.sizeStock as Record<string, number>) }
          : {};
      const optionStock: Record<string, Record<string, number>> = {};
      if (row.optionStock && typeof row.optionStock === "object") {
        for (const [g, counts] of Object.entries(
          row.optionStock as Record<string, Record<string, number>>,
        )) {
          if (counts && typeof counts === "object") optionStock[g] = { ...counts };
        }
      }

      const beforeSize = JSON.stringify(sizeStock);
      const beforeOption = JSON.stringify(optionStock);
      let productLevelCount: number | null = null;

      for (const v of variants) {
        const label = v.title;
        const isDefault = !label || label.toLowerCase() === DEFAULT_TITLE;
        // A real count when the Admin API gave one; otherwise only "sold out"
        // is knowable, so an available choice stays untracked.
        const count = v.inventoryQuantity ?? (v.availableForSale ? null : 0);

        if (isDefault) {
          if (count != null) productLevelCount = Math.max(0, count);
          continue;
        }
        if (axis?.options.includes(label)) {
          if (count == null) delete sizeStock[label];
          else sizeStock[label] = Math.max(0, count);
          continue;
        }
        const group = optionAxes.find((g) => g.options.includes(label));
        if (group) {
          const counts = (optionStock[group.name] ??= {});
          if (count == null) delete counts[label];
          else counts[label] = Math.max(0, count);
        }
      }

      for (const [g, counts] of Object.entries(optionStock)) {
        if (Object.keys(counts).length === 0) delete optionStock[g];
      }

      if (JSON.stringify(sizeStock) !== beforeSize) {
        data.sizeStock = sizeStock as Prisma.InputJsonValue;
      }
      if (JSON.stringify(optionStock) !== beforeOption) {
        data.optionStock = optionStock as Prisma.InputJsonValue;
      }
      // Products with no options carry a single count instead.
      if (
        productLevelCount != null &&
        !axis &&
        optionAxes.length === 0 &&
        row.stock !== productLevelCount
      ) {
        data.stock = productLevelCount;
        data.inStock = productLevelCount > 0;
      }

      const anyAvailable = variants.some((v) =>
        v.inventoryQuantity != null ? v.inventoryQuantity > 0 : v.availableForSale,
      );
      if (row.inStock !== anyAvailable && data.inStock === undefined) {
        data.inStock = anyAvailable;
      }
    }

    const oz = variants.map((v) => v.weightOz).find((w) => w && w > 0);
    if (oz && row.weightOz !== oz) data.weightOz = oz;

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
    revalidatePath("/admin/inventory");
  }

  return {
    total: all.length,
    nextOffset,
    done,
    updated,
    unmatched,
    withCounts: useApi,
  };
}

/** One-shot connection check for the sync page. */
export async function testShopifyConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!isShopifyApiConfigured()) {
    return {
      ok: false,
      message:
        "Admin API not configured — add SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Vercel.",
    };
  }
  try {
    const products = await fetchShopifyProducts();
    const withCounts = products.filter((p) =>
      p.variants.some((v) => v.inventoryQuantity != null),
    ).length;
    return {
      ok: true,
      message: `Connected. Found ${products.length} products in Shopify, ${withCounts} with stock counts.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Connection failed.",
    };
  }
}
