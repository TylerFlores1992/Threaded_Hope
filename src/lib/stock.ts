import type { Product, Variant } from "@/data/products";

/**
 * Per-size stock helpers, shared by the storefront (client) and the server
 * (checkout/webhook). Pure module — safe to import anywhere.
 *
 * Model: a product's "size axis" is the price-driving variant (the one with a
 * `prices` map), or failing that a variant named like "size". Stock is tracked
 * per option of that axis in `product.sizeStock` ({ "S": 5, "M": 0 }). A size is
 * SOLD OUT only when it has an explicit count of 0 — a size with no entry is
 * untracked (always available), so partial tracking never sells out a size by
 * accident.
 */
type StockShape = Pick<Product, "variants" | "sizeStock" | "inStock">;

export function sizeAxisOf(
  product: Pick<Product, "variants">,
): Variant | null {
  const priced = product.variants.find(
    (v) => v.prices && Object.keys(v.prices).length > 0,
  );
  if (priced) return priced;
  return product.variants.find((v) => /size/i.test(v.name)) ?? null;
}

/** True when this product has any per-size counts entered. */
export function tracksSizeStock(product: StockShape): boolean {
  return (
    sizeAxisOf(product) != null &&
    Object.keys(product.sizeStock ?? {}).length > 0
  );
}

/** A specific size option is sold out only if explicitly tracked at 0. */
export function sizeSoldOut(product: StockShape, size?: string): boolean {
  if (!size) return false;
  const count = product.sizeStock?.[size];
  return typeof count === "number" && count <= 0;
}

/** Whether the given option selection can be purchased right now. */
export function isAvailable(
  product: StockShape,
  options: Record<string, string> = {},
): boolean {
  if (!product.inStock) return false;
  const axis = sizeAxisOf(product);
  if (axis) return !sizeSoldOut(product, options[axis.name]);
  return true;
}

/** Default option for a variant — the first in-stock size on the size axis. */
export function defaultOption(product: StockShape, variant: Variant): string {
  const axis = sizeAxisOf(product);
  if (axis && axis.name === variant.name) {
    return (
      variant.options.find((o) => !sizeSoldOut(product, o)) ?? variant.options[0]
    );
  }
  return variant.options[0];
}

/** Overall in-stock flag, given the product-level flag and per-size counts. */
export function computeInStock(
  product: StockShape,
  productLevelInStock: boolean,
): boolean {
  if (!productLevelInStock) return false;
  const axis = sizeAxisOf(product);
  if (axis && Object.keys(product.sizeStock ?? {}).length > 0) {
    return axis.options.some((o) => !sizeSoldOut(product, o));
  }
  return true;
}
