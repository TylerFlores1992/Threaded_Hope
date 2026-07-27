"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { getPrisma } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { sizeAxisOf } from "@/lib/stock";
import type { Variant } from "@/data/products";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");


function revalidateStorefront(slug?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/gifting");
  revalidatePath("/collections/[slug]", "page");
  revalidatePath("/products/[slug]", "page");
  if (slug) revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");
}

async function uploadImage(file: File | null): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;
  const safe = slugify(file.name.replace(/\.[^.]+$/, "")) || "photo";
  const ext = file.name.match(/\.[^.]+$/)?.[0] ?? "";
  const blob = await put(`products/${safe}-${Date.now()}${ext}`, file, {
    access: "public",
  });
  return blob.url;
}

type Parsed = {
  name: string;
  description: string;
  priceCents: number;
  collectionSlug: string;
  collections: string[];
  featured: boolean;
  stock: number | null;
  variants: Variant[];
};

function parseForm(formData: FormData, validSlugs: Set<string>): Parsed {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();

  if (!name) throw new Error("Name is required.");
  if (!validSlugs.has(collectionSlug)) {
    throw new Error("Please choose a valid collection.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a positive number.");
  }

  // Full membership = primary + any additional checked collections (validated,
  // deduped, primary always first).
  const extra = formData
    .getAll("collections")
    .map((v) => String(v).trim())
    .filter((s) => s && validSlugs.has(s));
  const allCollections = Array.from(new Set([collectionSlug, ...extra]));

  // Structured sizes → a "Size" variant with optional per-size prices.
  const variants: Variant[] = [];
  if (formData.get("hasSizes") === "on") {
    const labels = formData.getAll("sizeLabel").map((v) => String(v).trim());
    const prices = formData.getAll("sizePrice").map((v) => String(v).trim());
    const options: string[] = [];
    const priceMap: Record<string, number> = {};
    labels.forEach((label, i) => {
      if (!label || options.includes(label)) return;
      options.push(label);
      const raw = prices[i] ?? "";
      const p = Number(raw);
      if (raw !== "" && Number.isFinite(p) && p >= 0) priceMap[label] = p;
    });
    if (options.length > 0) {
      const sizeVariant: Variant = { name: "Size", options };
      if (Object.keys(priceMap).length > 0) sizeVariant.prices = priceMap;
      variants.push(sizeVariant);
    }
  }
  // Non-size option groups (color, style, …) from the structured editor JSON.
  try {
    const parsed = JSON.parse(
      String(formData.get("otherOptions") ?? "[]"),
    ) as { name?: unknown; options?: unknown }[];
    for (const g of Array.isArray(parsed) ? parsed : []) {
      const gname = typeof g.name === "string" ? g.name.trim() : "";
      const opts = Array.isArray(g.options)
        ? g.options.map((o) => String(o).trim()).filter(Boolean)
        : [];
      if (gname && !/size/i.test(gname) && opts.length > 0) {
        variants.push({ name: gname, options: Array.from(new Set(opts)) });
      }
    }
  } catch {
    /* ignore malformed option JSON */
  }

  return {
    name,
    description,
    priceCents: Math.round(price * 100),
    collectionSlug,
    collections: allCollections,
    featured: formData.get("featured") === "on",
    stock: stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw))),
    variants,
  };
}

/**
 * In-stock is derived from inventory, not a manual toggle. Sized products get
 * their flag from per-size counts (managed in Inventory), so we leave it alone
 * on update and default new ones to available; unsized products follow `stock`.
 */
function derivedInStock(data: Parsed): boolean {
  return data.stock == null ? true : data.stock > 0;
}

export async function createProduct(formData: FormData): Promise<void> {
  const prisma = getPrisma();
  const validSlugs = new Set((await getAllCollections()).map((c) => c.slug));
  const data = parseForm(formData, validSlugs);
  const image = await uploadImage(formData.get("image") as File | null);

  // Ensure a unique slug.
  const base = slugify(data.name);
  let slug = base;
  let n = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }

  await prisma.product.create({
    data: {
      slug,
      name: data.name,
      description: data.description,
      priceCents: data.priceCents,
      collectionSlug: data.collectionSlug,
      collections: data.collections,
      featured: data.featured,
      // Sized products start available; per-size counts (set in Inventory)
      // take over from there. Unsized products follow their stock count.
      inStock: sizeAxisOf({ variants: data.variants }) ? true : derivedInStock(data),
      stock: data.stock,
      variants: data.variants,
      ...(image ? { image } : {}),
    },
  });

  revalidateStorefront(slug);
  redirect("/admin/products");
}

export async function updateProduct(
  id: string,
  formData: FormData,
): Promise<void> {
  const prisma = getPrisma();
  const validSlugs = new Set((await getAllCollections()).map((c) => c.slug));
  const data = parseForm(formData, validSlugs);
  const image = await uploadImage(formData.get("image") as File | null);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error("Product not found.");

  const sized = !!sizeAxisOf({ variants: data.variants });
  await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      priceCents: data.priceCents,
      collectionSlug: data.collectionSlug,
      collections: data.collections,
      featured: data.featured,
      stock: data.stock,
      variants: data.variants,
      // Unsized: derive from stock. Sized: leave inStock to Inventory's per-size
      // counts so a product edit can't accidentally un-sell-out a size.
      ...(sized ? {} : { inStock: derivedInStock(data) }),
      ...(image ? { image } : {}),
    },
  });

  revalidateStorefront(existing.slug);
  redirect("/admin/products");
}

export async function deleteProduct(id: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { id } });
  await prisma.product.delete({ where: { id } });
  revalidateStorefront(existing?.slug);
}
