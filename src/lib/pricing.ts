import type { Product } from "@/data/products";

/**
 * Price resolution shared by the client (display) and the server (authoritative
 * checkout), so both always agree on what a given option selection costs.
 *
 * A product's `price` is the base (lowest) price. A variant may carry a
 * `prices` map — the price-driving axis, e.g. size — and selecting one of its
 * options overrides the base price. Only one axis drives price in practice, but
 * if several were present, the last matching one wins.
 */
export function resolveUnitPrice(
  product: Pick<Product, "price" | "variants">,
  options: Record<string, string> = {},
): number {
  let price = product.price;
  for (const variant of product.variants) {
    if (!variant.prices) continue;
    const selected = options[variant.name];
    if (selected != null && variant.prices[selected] != null) {
      price = variant.prices[selected];
    }
  }
  return price;
}

/** Min/max price across the price-driving axis (base price when none varies). */
export function priceRange(
  product: Pick<Product, "price" | "variants">,
): { min: number; max: number } {
  const priced = product.variants.find((v) => v.prices);
  if (!priced || !priced.prices) return { min: product.price, max: product.price };
  const values = Object.values(priced.prices);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** True when price depends on the selected variant. */
export function hasVariablePricing(
  product: Pick<Product, "price" | "variants">,
): boolean {
  const { min, max } = priceRange(product);
  return min !== max;
}
