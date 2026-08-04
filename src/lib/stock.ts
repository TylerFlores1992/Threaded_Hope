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
type StockShape = Pick<Product, "variants" | "sizeStock" | "inStock"> & {
  optionStock?: OptionStock;
};

/** Per-option counts for non-size variant groups: { Color: { Sage: 3 } }. */
export type OptionStock = Record<string, Record<string, number>>;

export function sizeAxisOf(
  product: Pick<Product, "variants">,
): Variant | null {
  const priced = product.variants.find(
    (v) => v.prices && Object.keys(v.prices).length > 0,
  );
  if (priced) return priced;
  return product.variants.find((v) => /size/i.test(v.name)) ?? null;
}

/**
 * The non-size option groups (color, style, …). Each one can carry its own
 * counts in `optionStock`, exactly like sizes do in `sizeStock`.
 */
export function optionAxesOf(product: Pick<Product, "variants">): Variant[] {
  const axis = sizeAxisOf(product);
  return product.variants.filter((v) => v !== axis);
}

/** A non-size option is sold out only if explicitly tracked at 0. */
export function optionSoldOut(
  product: StockShape,
  group: string,
  option?: string,
): boolean {
  if (!option) return false;
  const count = product.optionStock?.[group]?.[option];
  return typeof count === "number" && count <= 0;
}

/** True when this option group has any counts entered. */
function tracksGroup(product: StockShape, group: string): boolean {
  return Object.keys(product.optionStock?.[group] ?? {}).length > 0;
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
  if (axis && sizeSoldOut(product, options[axis.name])) return false;
  // Every tracked non-size group must also have the chosen option in stock.
  for (const v of optionAxesOf(product)) {
    if (optionSoldOut(product, v.name, options[v.name])) return false;
  }
  return true;
}

/** Default option for a variant — the first one that isn't sold out. */
export function defaultOption(product: StockShape, variant: Variant): string {
  const axis = sizeAxisOf(product);
  const soldOut =
    axis && axis.name === variant.name
      ? (o: string) => sizeSoldOut(product, o)
      : (o: string) => optionSoldOut(product, variant.name, o);
  return variant.options.find((o) => !soldOut(o)) ?? variant.options[0];
}

/** Overall in-stock flag, given the product-level flag and per-size counts. */
export function computeInStock(
  product: StockShape,
  productLevelInStock: boolean,
): boolean {
  if (!productLevelInStock) return false;
  const axis = sizeAxisOf(product);
  if (
    axis &&
    Object.keys(product.sizeStock ?? {}).length > 0 &&
    !axis.options.some((o) => !sizeSoldOut(product, o))
  ) {
    return false;
  }
  // A tracked colour/style group with every option at 0 sells the product out.
  for (const v of optionAxesOf(product)) {
    if (
      tracksGroup(product, v.name) &&
      !v.options.some((o) => !optionSoldOut(product, v.name, o))
    ) {
      return false;
    }
  }
  return true;
}
