"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { computeInStock, type OptionStock } from "@/lib/stock";
import type { Variant } from "@/data/products";

/** Sets a product's stock. Empty string clears tracking (null). */
export async function setStock(id: string, value: string): Promise<void> {
  const prisma = getPrisma();
  const trimmed = value.trim();
  const stock =
    trimmed === "" ? null : Math.max(0, Math.floor(Number(trimmed) || 0));
  const data: { stock: number | null; inStock?: boolean } = { stock };
  // Auto-flip in-stock flag based on tracked count.
  if (stock != null) data.inStock = stock > 0;
  await prisma.product.update({ where: { id }, data });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

/**
 * Sets the stock for a single size of a product. Empty string clears tracking
 * for that size (untracked = always available). Recomputes the overall in-stock
 * flag from the remaining per-size counts.
 */
export async function setSizeStock(
  id: string,
  size: string,
  value: string,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.product.findUnique({ where: { id } });
  if (!row) throw new Error("Product not found.");

  const sizeStock: Record<string, number> =
    row.sizeStock && typeof row.sizeStock === "object"
      ? { ...(row.sizeStock as Record<string, number>) }
      : {};

  const trimmed = value.trim();
  if (trimmed === "") delete sizeStock[size];
  else sizeStock[size] = Math.max(0, Math.floor(Number(trimmed) || 0));

  const variants = (Array.isArray(row.variants) ? row.variants : []) as Variant[];
  const inStock = computeInStock(
    { variants, sizeStock, optionStock: readOptionStock(row.optionStock), inStock: true },
    true,
  );

  await prisma.product.update({
    where: { id },
    data: { sizeStock: sizeStock as Prisma.InputJsonValue, inStock },
  });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

/** Reads the nested optionStock JSON into a plain (mutable) shape. */
function readOptionStock(value: unknown): OptionStock {
  if (!value || typeof value !== "object") return {};
  const out: OptionStock = {};
  for (const [group, counts] of Object.entries(value as Record<string, unknown>)) {
    if (!counts || typeof counts !== "object") continue;
    out[group] = { ...(counts as Record<string, number>) };
  }
  return out;
}

/**
 * Sets the stock for one option of a non-size group (e.g. Color → Sage). Empty
 * string clears tracking for that option; 0 marks it sold out. Mirrors
 * `setSizeStock`, and recomputes the overall in-stock flag the same way.
 */
export async function setOptionStock(
  id: string,
  group: string,
  option: string,
  value: string,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.product.findUnique({ where: { id } });
  if (!row) throw new Error("Product not found.");

  const optionStock = readOptionStock(row.optionStock);
  const counts = optionStock[group] ?? {};

  const trimmed = value.trim();
  if (trimmed === "") delete counts[option];
  else counts[option] = Math.max(0, Math.floor(Number(trimmed) || 0));

  if (Object.keys(counts).length === 0) delete optionStock[group];
  else optionStock[group] = counts;

  const variants = (Array.isArray(row.variants) ? row.variants : []) as Variant[];
  const sizeStock =
    row.sizeStock && typeof row.sizeStock === "object"
      ? (row.sizeStock as Record<string, number>)
      : {};
  const inStock = computeInStock({ variants, sizeStock, optionStock, inStock: true }, true);

  await prisma.product.update({
    where: { id },
    data: { optionStock: optionStock as Prisma.InputJsonValue, inStock },
  });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}
