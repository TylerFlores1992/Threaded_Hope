"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";

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
