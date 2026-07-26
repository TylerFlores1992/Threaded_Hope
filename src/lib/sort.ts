import type { Product } from "@/data/products";

/**
 * Comparator that puts in-stock products before sold-out ones. Returns 0 when
 * both share the same availability, so it composes as a primary key ahead of
 * any secondary sort (price, newest, …) and, on its own, sorts stably.
 */
export const inStockFirst = (a: Product, b: Product): number =>
  Number(b.inStock) - Number(a.inStock);

/**
 * Returns a copy of `list` with sold-out items moved below in-stock ones,
 * preserving the incoming order within each group (JS sort is stable).
 */
export function withInStockFirst(list: Product[]): Product[] {
  return [...list].sort(inStockFirst);
}
