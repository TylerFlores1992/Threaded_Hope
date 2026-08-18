/**
 * The variant choices on an ordered line — size, colour, style, anything else.
 *
 * An order line keeps its size in `size` and every other choice in `options`
 * (`{ Color: "Blue" }`), the shape the Stripe webhook writes. Only the size was
 * ever rendered, so a product whose only choice was a colour printed as a bare
 * name on the packing slip and nobody could tell which one to make. Everything
 * that shows an ordered line goes through here so they all agree.
 */
export type OrderItemLike = {
  size?: string | null;
  options?: unknown;
};

export type VariantChoice = { label: string; value: string };

/** The stored `options` blob, ignoring anything that isn't a string pair. */
function readOptions(raw: unknown): VariantChoice[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(
      ([k, v]) => typeof v === "string" && v.trim() !== "" && k.trim() !== "",
    )
    .map(([label, value]) => ({ label, value: value as string }));
}

/**
 * Every choice on the line, size first — it's the one people scan for.
 * Empty when the product had no choices to make.
 */
export function variantChoices(item: OrderItemLike): VariantChoice[] {
  const choices: VariantChoice[] = [];
  if (typeof item.size === "string" && item.size.trim() !== "") {
    choices.push({ label: "Size", value: item.size });
  }
  choices.push(...readOptions(item.options));
  return choices;
}

/** One line of choices: `Size: M · Color: Blue`. Empty string when there are none. */
export function variantSummary(item: OrderItemLike, sep = " · "): string {
  return variantChoices(item)
    .map((c) => `${c.label}: ${c.value}`)
    .join(sep);
}

/** Compact form for lists and CSVs: `M, Blue` — values only, no labels. */
export function variantValues(item: OrderItemLike, sep = ", "): string {
  return variantChoices(item)
    .map((c) => c.value)
    .join(sep);
}
