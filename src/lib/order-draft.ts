/**
 * The shape of a half-finished sale.
 *
 * One definition, shared three ways: the Record-a-sale form holds it in state,
 * the browser autosaves it to `localStorage` against an accidental loss, and
 * `OrderDraft.payload` keeps it in the database when the shop owner parks an
 * order on purpose. A plain module (no `server-only`) because the form that
 * produces it is a client component.
 *
 * It is the *form's* state, not an order: strings as typed, nothing resolved.
 * Prices and discounts are re-read from the catalog when the sale is actually
 * recorded, so a draft that sat for a fortnight can't bank a stale price.
 */

export type DraftRow = {
  slug: string;
  size: string;
  /** Chosen non-size options, keyed by group name. */
  options: Record<string, string>;
  quantity: string;
  price: string;
};

export type DraftPromo = {
  code: string;
  label: string;
  discountCents: number;
};

export type DraftAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

export const DRAFT_VERSION = 1;

export type OrderDraftPayload = {
  v: number;
  rows: DraftRow[];
  customerName: string;
  email: string;
  phone: string;
  notes: string;
  addr: DraftAddress;
  ship: boolean;
  invoice: boolean;
  shippingCharged: string;
  decrement: boolean;
  codeInput: string;
  promo: DraftPromo | null;
};

/**
 * Trust nothing: a payload arrives from the browser, and a stored one may have
 * been written by an older version of this file. Anything that doesn't parse
 * is rejected outright rather than half-applied — a draft that restores three
 * of its five fields is worse than one that admits it's unreadable.
 */
export function parseDraftPayload(raw: unknown): OrderDraftPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<OrderDraftPayload>;
  if (d.v !== DRAFT_VERSION || !Array.isArray(d.rows)) return null;

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const bool = (v: unknown) => v === true;

  const rows: DraftRow[] = d.rows.slice(0, 100).map((r) => {
    const row = (r ?? {}) as Partial<DraftRow>;
    const options: Record<string, string> = {};
    if (row.options && typeof row.options === "object") {
      for (const [k, v] of Object.entries(row.options)) {
        if (typeof v === "string") options[k] = v;
      }
    }
    return {
      slug: str(row.slug),
      size: str(row.size),
      options,
      quantity: str(row.quantity) || "1",
      price: str(row.price),
    };
  });

  const a = (d.addr ?? {}) as Partial<DraftAddress>;
  const promo =
    d.promo &&
    typeof d.promo === "object" &&
    typeof d.promo.code === "string" &&
    typeof d.promo.discountCents === "number"
      ? {
          code: d.promo.code,
          label: str(d.promo.label),
          discountCents: d.promo.discountCents,
        }
      : null;

  return {
    v: DRAFT_VERSION,
    rows,
    customerName: str(d.customerName),
    email: str(d.email),
    phone: str(d.phone),
    notes: str(d.notes),
    addr: {
      line1: str(a.line1),
      line2: str(a.line2),
      city: str(a.city),
      state: str(a.state),
      postal: str(a.postal),
      country: str(a.country) || "US",
    },
    ship: bool(d.ship),
    invoice: bool(d.invoice),
    shippingCharged: str(d.shippingCharged) || "0",
    decrement: d.decrement !== false,
    codeInput: str(d.codeInput),
    promo,
  };
}

/** Is there anything here worth keeping? An untouched form is not a draft. */
export function draftHasContent(
  d: Pick<
    OrderDraftPayload,
    "rows" | "customerName" | "email" | "phone" | "notes"
  >,
): boolean {
  return (
    d.rows.some((r) => r.slug) ||
    Boolean(d.customerName.trim()) ||
    Boolean(d.email.trim()) ||
    Boolean(d.phone.trim()) ||
    Boolean(d.notes.trim())
  );
}

/** Counts for the saved-drafts list, so it reads without parsing every payload. */
export function summarizeDraft(d: OrderDraftPayload): {
  itemCount: number;
  subtotalCents: number;
} {
  let itemCount = 0;
  let subtotalCents = 0;
  for (const r of d.rows) {
    if (!r.slug) continue;
    const qty = Math.max(1, Math.floor(Number(r.quantity) || 1));
    const price = Number(r.price);
    itemCount += qty;
    if (Number.isFinite(price) && price >= 0) {
      subtotalCents += Math.round(price * 100) * qty;
    }
  }
  return { itemCount, subtotalCents };
}

/**
 * What to call a draft she didn't name.
 *
 * Deliberately not the item count: the list already prints that next to the
 * label, and an unnamed draft read "1 item · 1 item · $10.00". The caller
 * passes a product name when it can resolve one — this module only has slugs.
 */
export function fallbackDraftLabel(
  d: OrderDraftPayload,
  firstItemName?: string | null,
): string {
  if (d.customerName.trim()) return d.customerName.trim();
  if (firstItemName?.trim()) return firstItemName.trim();
  return "Untitled sale";
}

/** The slug of the first real row, for resolving a name to label a draft by. */
export function firstDraftSlug(d: OrderDraftPayload): string | null {
  return d.rows.find((r) => r.slug)?.slug ?? null;
}
