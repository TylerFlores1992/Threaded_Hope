/**
 * How products are ordered on a collection page — Shopify's sort options.
 * Plain module so both the server actions and the admin form can import it
 * ("use server" files may only export async functions).
 */
export const SORT_MODES = [
  { id: "manual", label: "Manually (drag to arrange)" },
  { id: "best-selling", label: "Best selling" },
  { id: "alpha-asc", label: "Alphabetically, A–Z" },
  { id: "alpha-desc", label: "Alphabetically, Z–A" },
  { id: "price-asc", label: "Price, low to high" },
  { id: "price-desc", label: "Price, high to low" },
  { id: "date-desc", label: "Date, new to old" },
  { id: "date-asc", label: "Date, old to new" },
] as const;

export const SORT_IDS = new Set<string>(SORT_MODES.map((m) => m.id));
