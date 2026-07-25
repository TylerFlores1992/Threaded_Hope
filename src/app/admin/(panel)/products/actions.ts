"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { getPrisma } from "@/lib/db";
import { collections } from "@/data/collections";
import type { Variant } from "@/data/products";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Parse the variants textarea: one line per group, e.g. "Color: Sage, Cream". */
function parseVariants(raw: string): Variant[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, opts = ""] = line.split(":");
      return {
        name: name.trim(),
        options: opts
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      };
    })
    .filter((v) => v.name && v.options.length > 0);
}

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
  featured: boolean;
  inStock: boolean;
  stock: number | null;
  variants: Variant[];
};

function parseForm(formData: FormData): Parsed {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();

  if (!name) throw new Error("Name is required.");
  if (!collections.some((c) => c.slug === collectionSlug)) {
    throw new Error("Please choose a valid collection.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a positive number.");
  }

  return {
    name,
    description,
    priceCents: Math.round(price * 100),
    collectionSlug,
    featured: formData.get("featured") === "on",
    inStock: formData.get("inStock") === "on",
    stock: stockRaw === "" ? null : Math.max(0, Math.floor(Number(stockRaw))),
    variants: parseVariants(String(formData.get("variants") ?? "")),
  };
}

export async function createProduct(formData: FormData): Promise<void> {
  const prisma = getPrisma();
  const data = parseForm(formData);
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
      featured: data.featured,
      inStock: data.inStock,
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
  const data = parseForm(formData);
  const image = await uploadImage(formData.get("image") as File | null);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error("Product not found.");

  await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      priceCents: data.priceCents,
      collectionSlug: data.collectionSlug,
      featured: data.featured,
      inStock: data.inStock,
      stock: data.stock,
      variants: data.variants,
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
