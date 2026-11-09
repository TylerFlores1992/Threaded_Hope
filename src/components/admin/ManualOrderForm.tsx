"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import {
  checkPromoCode,
  createManualOrder,
  deleteOrderDraft,
  saveOrderDraft,
} from "@/app/admin/(panel)/orders/new/actions";
import { SearchSelect } from "./SearchSelect";
import {
  DRAFT_VERSION,
  draftHasContent,
  fallbackDraftLabel,
  firstDraftSlug,
  type DraftAddress,
  type DraftPromo,
  type DraftRow,
  type OrderDraftPayload,
} from "@/lib/order-draft";
import {
  pickBestRule,
  ruleDiscountCents,
  type DiscountRule,
} from "@/lib/discount-rules";

export type PickerProduct = {
  slug: string;
  name: string;
  price: number; // dollars
  sizes: string[];
  /** Non-size choice groups (colour, style, …). */
  optionGroups: { name: string; options: string[] }[];
};

export type PickerCustomer = {
  email: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
};

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink";

function SubmitButton({ invoice }: { invoice: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage disabled:opacity-60"
    >
      {pending
        ? invoice
          ? "Sending…"
          : "Saving…"
        : invoice
          ? "Create & email invoice"
          : "Record sale"}
    </button>
  );
}

type Row = DraftRow;
type Promo = DraftPromo;

const emptyRow: Row = { slug: "", size: "", options: {}, quantity: "1", price: "" };

/**
 * Unfinished sales, kept in the browser.
 *
 * Nothing on this form was written anywhere until "Record sale" was pressed, so
 * closing the tab — or a server-side validation bounce, which remounts the page
 * and resets every `useState` — threw away everything typed so far. A sale
 * entered at a fair is a dozen fields of someone else's details; retyping it is
 * the kind of thing that stops you recording sales at all.
 *
 * Deliberately per-browser (`localStorage`) rather than a row in the database:
 * it's one shop owner on one device finishing what she started, and a draft
 * that needs a table, a list page and a delete button is a bigger thing than
 * the problem. It does mean a draft doesn't follow her from phone to laptop.
 *
 * Note it holds a customer's name, email, phone and address until the sale is
 * recorded or the draft discarded. That's the same device already signed in to
 * the admin, but it does outlive the session — worth knowing on a shared one.
 */
const DRAFT_KEY = "threaded-hope-manual-order-draft";

/** The autosaved copy: the shared payload plus when it was written. */
type Draft = OrderDraftPayload & {
  savedAt: number;
  /** Set when the form was submitted; see `finished` for why. */
  submittedAt?: number;
};

/** A sale parked on purpose, as the Record-a-sale page lists it. */
export type SavedDraft = {
  id: string;
  label: string | null;
  customerName: string | null;
  itemCount: number;
  subtotalCents: number;
  /** ISO string: a Date would not survive the server/client boundary intact. */
  updatedAt: string;
  payload: OrderDraftPayload;
};

type Address = DraftAddress;

/**
 * Every access is wrapped: `localStorage` throws outright in a locked-down or
 * private window, and a draft is a convenience — it must never be the reason
 * the page fails to render.
 */
function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    // A draft written by an older shape is discarded rather than half-applied.
    if (!parsed || parsed.v !== DRAFT_VERSION || !Array.isArray(parsed.rows)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Validate a raw stored string into a draft, or nothing. */
function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Draft;
    // A draft written by an older shape is discarded rather than half-applied.
    if (!parsed || parsed.v !== DRAFT_VERSION || !Array.isArray(parsed.rows)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* a full or disabled store is not worth interrupting the sale for */
  }
}

function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* as above */
  }
}

/**
 * The draft as it stood **when this page was opened**, read through
 * `useSyncExternalStore`.
 *
 * Two things force this shape. First, reading browser storage during render is
 * the trap this codebase has hit four times (ProductPager's sort, the chart's
 * `<title>`, the orders table, the products table): server and client render
 * different text, React reports a #418 mismatch and silently throws the tree
 * away. `useSyncExternalStore` is the documented way out — hydrate against the
 * server snapshot (no draft), then swap in the real one.
 *
 * Second, the snapshot is cached per visit rather than re-read live, because
 * autosave writes to the same key: a live snapshot would notice the user's own
 * first keystrokes and pop an "unfinished sale" banner at them while they type.
 * What's offered back has to be what was there on arrival.
 */
let openedWith: string | null | undefined;

function draftSnapshot(): string | null {
  if (openedWith === undefined) {
    try {
      openedWith = window.localStorage.getItem(DRAFT_KEY);
    } catch {
      openedWith = null;
    }
  }
  return openedWith;
}

/** Server render has no browser storage, so there is never a draft there. */
function noDraftOnServer(): null {
  return null;
}

/** Nothing to subscribe to: this value is fixed for the life of the visit. */
function subscribeToNothing(): () => void {
  return () => {};
}

/** Forget the cached read so the next visit to the form sees current storage. */
function forgetSnapshot(): void {
  openedWith = undefined;
}

/** Is there anything here worth keeping? An untouched form is not a draft. */

/** "3 items · 5 minutes ago" — enough to recognise a draft without opening it. */
function describeDraft(d: Draft): string {
  const items = d.rows.filter((r) => r.slug).length;
  const parts: string[] = [];
  if (items) parts.push(`${items} item${items === 1 ? "" : "s"}`);
  if (d.customerName.trim()) parts.push(d.customerName.trim());
  const mins = Math.round((Date.now() - d.savedAt) / 60000);
  parts.push(
    mins < 1 ? "just now"
      : mins < 60 ? `${mins} minute${mins === 1 ? "" : "s"} ago`
      : mins < 1440 ? `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? "" : "s"} ago`
      : `${Math.round(mins / 1440)} day${Math.round(mins / 1440) === 1 ? "" : "s"} ago`,
  );
  return parts.join(" · ");
}

/** Records an off-site sale, or bills one by emailing an invoice. */
export function ManualOrderForm({
  products,
  customers,
  discountRules = [],
  hadError = false,
  savedDrafts = [],
}: {
  products: PickerProduct[];
  customers: PickerCustomer[];
  /** Active automatic rules, so the discount is visible before saving. */
  discountRules?: DiscountRule[];
  /** True when the server bounced the last submit back with a message. */
  hadError?: boolean;
  /** Sales parked on purpose, newest first. */
  savedDrafts?: SavedDraft[];
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow]);
  const [ship, setShip] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [shippingCharged, setShippingCharged] = useState("0");

  // Customer fields are controlled so picking a saved customer can fill them.
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Controlled so they can be written back into a restored draft.
  const [notes, setNotes] = useState("");
  const [decrement, setDecrement] = useState(true);
  const [addr, setAddr] = useState<Address>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal: "",
    country: "US",
  });

  /** Set once she has restored or discarded what was waiting. */
  const [draftHandled, setDraftHandled] = useState(false);
  /**
   * Latched when the form is submitted, to stop a debounced autosave that was
   * already in flight from landing afterwards and wiping the submitted mark —
   * which would leave a finished sale being offered back as an unfinished one.
   */
  const submitted = useRef(false);

  /**
   * The parked draft this form is currently editing, if it was opened from one.
   * Saving again updates that row instead of breeding a second copy, and
   * recording the sale retires it (the hidden `draftId` below carries it to the
   * server action).
   */
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [saveState, setSaveState] = useState<
    { kind: "idle" } | { kind: "saved"; at: number } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [saving, startSaving] = useTransition();

  const [codeInput, setCodeInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  /** Current form state as the shared payload shape. */
  const payload = (): OrderDraftPayload => ({
    v: DRAFT_VERSION,
    rows, customerName, email, phone, notes, addr,
    ship, invoice, shippingCharged, decrement, codeInput, promo,
  });

  const applyDraft = useCallback((d: OrderDraftPayload) => {
    setRows(d.rows.length ? d.rows : [emptyRow]);
    setCustomerName(d.customerName);
    setEmail(d.email);
    setPhone(d.phone);
    setNotes(d.notes);
    setAddr(d.addr);
    setShip(d.ship);
    setInvoice(d.invoice);
    setShippingCharged(d.shippingCharged);
    setDecrement(d.decrement);
    setCodeInput(d.codeInput);
    // The server re-checks any code on submit, so a restored one can't
    // mis-charge — at worst it's re-validated against the same subtotal.
    setPromo(d.promo);
  }, []);

  // What was in storage when this page was opened (see `draftSnapshot`).
  const openingDraft = parseDraft(
    useSyncExternalStore(subscribeToNothing, draftSnapshot, noDraftOnServer),
  );

  /**
   * A draft marked submitted belongs to a sale that went through — the
   * redirect to the order page is the only way to leave without an error. So
   * on a plain visit it is finished business and gets cleared; arriving *with*
   * an error means the sale did not save, and the draft is still live.
   */
  const finished = Boolean(openingDraft?.submittedAt) && !hadError;

  const restorable =
    openingDraft && !draftHandled && !finished && draftHasContent(openingDraft)
      ? openingDraft
      : null;

  // Writing to storage is what effects are for; no React state is set here.
  useEffect(() => {
    if (finished) clearDraft();
  }, [finished]);

  // Re-read storage on the next visit rather than reusing this visit's value.
  useEffect(() => forgetSnapshot, []);

  // Autosave. Debounced so a burst of typing is one write, and skipped for an
  // untouched form so an empty visit can't bury a real draft.
  useEffect(() => {
    const snapshot = {
      rows, customerName, email, phone, notes,
    };
    if (!draftHasContent(snapshot)) return;
    // Don't overwrite a draft that's still sitting in the banner unrestored —
    // the form underneath it is empty, and this would be the empty one winning.
    if (restorable) return;

    const t = setTimeout(() => {
      if (submitted.current) return;
      writeDraft({
        v: DRAFT_VERSION,
        savedAt: Date.now(),
        rows, customerName, email, phone, notes, addr,
        ship, invoice, shippingCharged, decrement, codeInput, promo,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [
    restorable,
    rows, customerName, email, phone, notes, addr,
    ship, invoice, shippingCharged, decrement, codeInput, promo,
  ]);

  /**
   * Mark the draft submitted rather than deleting it.
   *
   * If the server rejects the sale it redirects back here with a message and
   * the whole component remounts with fresh state — so deleting on submit
   * would lose the form exactly when she most needs it back. The mark is what
   * `finished` above reads to tell "it saved" from "it bounced".
   */
  const onSubmit = () => {
    submitted.current = true;
    const current = readDraft();
    if (current) writeDraft({ ...current, submittedAt: Date.now() });
  };

  const onSaveDraft = () => {
    setSaveState({ kind: "idle" });
    startSaving(async () => {
      const res = await saveOrderDraft(payload(), draftId ?? undefined, draftLabel);
      if (res.ok) {
        setDraftId(res.id);
        setSaveState({ kind: "saved", at: Date.now() });
      } else {
        setSaveState({ kind: "error", message: res.error });
      }
    });
  };

  const onOpenDraft = (d: SavedDraft) => {
    applyDraft(d.payload);
    setDraftId(d.id);
    setDraftLabel(d.label ?? "");
    setSaveState({ kind: "idle" });
    // The parked draft is now what's on screen, so the browser's accidental-loss
    // copy is stale; let autosave write the restored state over it.
    setDraftHandled(true);
  };

  const onDeleteDraft = (d: SavedDraft) => {
    startSaving(async () => {
      await deleteOrderDraft(d.id);
      // Opened, then deleted: the form keeps its contents but is no longer
      // editing a stored row, so the next save creates a new one.
      if (draftId === d.id) setDraftId(null);
    });
  };

  const productOf = (slug: string) => products.find((p) => p.slug === slug);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const onProduct = (i: number, slug: string) => {
    const p = productOf(slug);
    update(i, {
      slug,
      size: "",
      options: {},
      // Prefill the catalog price; still editable (friend price, discount…).
      price: p ? String(p.price) : "",
    });
    // The old discount was worked out against a different subtotal.
    setPromo(null);
  };

  const onCustomer = (chosenEmail: string) => {
    const c = customers.find((x) => x.email === chosenEmail);
    if (!c) return;
    setEmail(c.email);
    if (c.name) setCustomerName(c.name);
    if (c.phone) setPhone(c.phone);
    if (c.address) {
      setAddr({
        line1: c.address.line1 ?? "",
        line2: c.address.line2 ?? "",
        city: c.address.city ?? "",
        state: c.address.state ?? "",
        postal: c.address.postal_code ?? "",
        country: c.address.country ?? "US",
      });
    }
  };

  const subtotal = rows.reduce((sum, r) => {
    const qty = Math.max(1, Math.floor(Number(r.quantity) || 1));
    const price = Number(r.price);
    return sum + (Number.isFinite(price) ? price * qty : 0);
  }, 0);
  const subtotalCents = Math.round(subtotal * 100);

  // Only rows with a product chosen count — an empty row left at the bottom of
  // the form is not an item, and counting it would fire a bundle rule an item
  // early.
  const totalQty = rows.reduce(
    (n, r) =>
      r.slug ? n + Math.max(1, Math.floor(Number(r.quantity) || 1)) : n,
    0,
  );

  // The automatic rule this sale qualifies for, mirroring what the server will
  // work out on submit. A typed code is deliberate and takes its place.
  const autoRule = promo
    ? null
    : pickBestRule(discountRules, { totalQty, subtotalCents });
  const autoDiscountCents = autoRule
    ? Math.min(ruleDiscountCents(autoRule, { totalQty, subtotalCents }), subtotalCents)
    : 0;

  const discountCents = promo ? promo.discountCents : autoDiscountCents;
  const discountLabel = promo ? promo.code : autoRule?.label ?? null;
  const discount = discountCents / 100;
  const shippingNum = ship ? Math.max(0, Number(shippingCharged) || 0) : 0;
  const total = Math.max(0, subtotal - discount + shippingNum);

  const applyCode = () => {
    setPromoError(null);
    startCheck(async () => {
      const res = await checkPromoCode(codeInput, subtotalCents);
      if (res.ok) {
        setPromo({
          code: res.code,
          label: res.label,
          discountCents: res.discountCents,
        });
        setCodeInput(res.code);
      } else {
        setPromo(null);
        setPromoError(res.error);
      }
    });
  };

  return (
    <form
      action={createManualOrder}
      onSubmit={onSubmit}
      className="max-w-2xl space-y-5"
    >
      {/* ── Parked sales ───────────────────────────────── */}
      {savedDrafts.length > 0 && (
        <div className="admin-card p-4">
          <p className="text-sm font-medium text-ink">Saved drafts</p>
          <p className="mb-3 text-xs text-ink-soft">
            Orders got ready but not recorded. Opening one loads it here;
            recording the sale clears it.
          </p>
          <ul className="divide-y divide-border">
            {savedDrafts.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-sm text-ink">
                  {d.label ||
                    d.customerName ||
                    fallbackDraftLabel(
                      d.payload,
                      productOf(firstDraftSlug(d.payload) ?? "")?.name,
                    )}
                  <span className="text-ink-soft">
                    {" · "}
                    {d.itemCount} item{d.itemCount === 1 ? "" : "s"}
                    {d.subtotalCents > 0 &&
                      ` · $${(d.subtotalCents / 100).toFixed(2)}`}
                  </span>
                  {draftId === d.id && (
                    <span className="ml-2 rounded bg-sage-deep px-1.5 py-0.5 text-[11px] font-medium text-white">
                      open
                    </span>
                  )}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDraft(d)}
                    disabled={saving}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand disabled:opacity-50"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(d)}
                    disabled={saving}
                    className="rounded px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Unfinished sale ───────────────────────────────────────── */}
      {restorable && (
        <div className="rounded-lg border border-border bg-sand p-4">
          <p className="text-sm font-medium text-ink">
            You have an unfinished sale
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {describeDraft(restorable)}. Pick up where you left off, or start
            fresh.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                applyDraft(restorable);
                writeDraft({ ...restorable, submittedAt: undefined });
                setDraftHandled(true);
              }}
              className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Restore it
            </button>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                setDraftHandled(true);
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Items ─────────────────────────────────────────────────── */}
      <div className="admin-card p-4">
        <p className="mb-3 text-sm font-medium text-ink">Items</p>
        <div className="space-y-3">
          {rows.map((row, i) => {
            const p = productOf(row.slug);
            return (
              // The product search gets the full width of its own row. Sharing
              // a row with the number fields squeezed it down to a few visible
              // characters, which is no use for something you type into.
              <div
                key={i}
                className="border-b border-border pb-3 last:border-0"
              >
                <label className="block text-xs text-ink-soft">
                  Product
                  <SearchSelect
                    name="slug"
                    required
                    value={row.slug}
                    onChange={(slug) => onProduct(i, slug)}
                    placeholder="Search products…"
                    emptyText="No products match."
                    options={products.map((op) => ({
                      value: op.slug,
                      label: op.name,
                      hint: `$${op.price.toFixed(2)}`,
                    }))}
                  />
                </label>

                <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-xs text-ink-soft">
                  Size
                  <select
                    name="size"
                    value={row.size}
                    onChange={(e) => update(i, { size: e.target.value })}
                    disabled={!p || p.sizes.length === 0}
                    className={field}
                  >
                    <option value="">—</option>
                    {(p?.sizes ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                {/* One select per non-size group, so an in-person sale records
                    the colour the same way a website order does. Always
                    submitted — even empty — to stay aligned with the row index. */}
                <input
                  type="hidden"
                  name="options"
                  value={JSON.stringify(row.options)}
                />
                {(p?.optionGroups ?? []).map((g) => (
                  <label key={g.name} className="text-xs text-ink-soft">
                    {g.name}
                    <select
                      value={row.options[g.name] ?? ""}
                      onChange={(e) =>
                        update(i, {
                          options: { ...row.options, [g.name]: e.target.value },
                        })
                      }
                      className={field}
                    >
                      <option value="">—</option>
                      {g.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}

                <label className="text-xs text-ink-soft">
                  Qty
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) => {
                      update(i, { quantity: e.target.value });
                      setPromo(null);
                    }}
                    className={`${field} !w-20 block`}
                  />
                </label>

                <label className="text-xs text-ink-soft">
                  Price each ($)
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => {
                      update(i, { price: e.target.value });
                      setPromo(null);
                    }}
                    className={`${field} !w-28 block`}
                  />
                </label>

                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRows((r) => r.filter((_, j) => j !== i));
                      setPromo(null);
                    }}
                    className="mb-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((r) => [...r, emptyRow])}
          className="mt-3 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand"
        >
          + Add item
        </button>
      </div>

      {/* ── Discount ──────────────────────────────────────────────── */}
      <div className="admin-card p-4">
        <p className="mb-1 text-sm font-medium text-ink">Discount code</p>
        <p className="mb-3 text-xs text-ink-soft">
          The same codes customers type at checkout, from the Discounts page.
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              setPromo(null);
              setPromoError(null);
            }}
            placeholder="e.g. WELCOME10"
            className="w-48 rounded-lg border border-border bg-white px-3 py-2 text-sm uppercase text-ink placeholder:normal-case"
          />
          <button
            type="button"
            onClick={applyCode}
            disabled={checking || !codeInput.trim() || subtotalCents <= 0}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand disabled:opacity-50"
          >
            {checking ? "Checking…" : "Apply"}
          </button>
          {promo && (
            <button
              type="button"
              onClick={() => {
                setPromo(null);
                setCodeInput("");
              }}
              className="rounded px-2 py-2 text-xs text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
        {promo && (
          <p className="mt-2 text-sm text-sage-deep">
            {promo.label} — −${(promo.discountCents / 100).toFixed(2)} applied.
          </p>
        )}
        {/* An automatic rule that already fired. Said out loud so the owner
            isn't surprised by the total, and so it's obvious that typing a code
            replaces it rather than stacking with it. */}
        {!promo && autoRule && autoDiscountCents > 0 && (
          <p className="mt-2 text-sm text-sage-deep">
            {autoRule.label} applied automatically — −$
            {(autoDiscountCents / 100).toFixed(2)}. A code you enter here
            replaces it.
          </p>
        )}
        {promoError && (
          <p className="mt-2 text-sm text-red-700">{promoError}</p>
        )}
        {/* Only a code that validated is submitted; the server checks it again. */}
        <input type="hidden" name="promoCode" value={promo?.code ?? ""} />
      </div>

      {/* ── Customer ──────────────────────────────────────────────── */}
      <div className="admin-card p-4">
        <p className="mb-1 text-sm font-medium text-ink">Customer</p>
        {customers.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-ink-soft">
              Pick someone who&apos;s ordered before to fill everything in, or
              just type below.
            </p>
            <SearchSelect
              value=""
              onChange={onCustomer}
              placeholder="Search saved customers…"
              emptyText="No customers match."
              options={customers.map((c) => ({
                value: c.email,
                label: c.name ?? c.email,
                hint: `${c.email} · ${c.orderCount} order${c.orderCount === 1 ? "" : "s"}`,
              }))}
            />
          </>
        ) : (
          <p className="mb-2 text-xs text-ink-soft">
            No saved customers yet — fill these in by hand.
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-soft">
            Name
            <input
              name="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Email {invoice ? "(required to invoice)" : "(optional)"}
            <input
              name="email"
              type="email"
              required={invoice}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Phone (optional)
            <input
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Note (e.g. paid cash / Venmo)
            <input
              name="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={field}
            />
          </label>
        </div>
      </div>

      {/* ── Delivery ──────────────────────────────────────────────── */}
      <div className="admin-card p-4">
        <p className="mb-2 text-sm font-medium text-ink">Delivery</p>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="delivery"
              value="pickup"
              checked={!ship}
              onChange={() => setShip(false)}
              className="mt-1"
            />
            <span>
              In person
              <span className="block text-xs text-ink-soft">
                Pickup, a fair, a friend — nothing to post. Mark it picked up
                from the order list once they have it.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="delivery"
              value="ship"
              checked={ship}
              onChange={() => setShip(true)}
              className="mt-1"
            />
            <span>
              Ship it
              <span className="block text-xs text-ink-soft">
                Adds it to “To ship” so you can buy a label.
              </span>
            </span>
          </label>
        </div>

        {ship && (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <label className="text-xs text-ink-soft sm:col-span-2">
              Address
              <input
                name="addrLine1"
                type="text"
                required
                placeholder="Street address"
                value={addr.line1}
                onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-xs text-ink-soft sm:col-span-2">
              Apartment, suite, etc. (optional)
              <input
                name="addrLine2"
                type="text"
                value={addr.line2}
                onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-xs text-ink-soft">
              City
              <input
                name="addrCity"
                type="text"
                required
                value={addr.city}
                onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-xs text-ink-soft">
              State
              <input
                name="addrState"
                type="text"
                required
                value={addr.state}
                onChange={(e) => setAddr({ ...addr, state: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-xs text-ink-soft">
              ZIP
              <input
                name="addrPostal"
                type="text"
                required
                value={addr.postal}
                onChange={(e) => setAddr({ ...addr, postal: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-xs text-ink-soft">
              Country
              <input
                name="addrCountry"
                type="text"
                value={addr.country}
                onChange={(e) => setAddr({ ...addr, country: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-xs text-ink-soft">
              Shipping charged ($)
              <input
                name="shipping"
                type="number"
                min="0"
                step="0.01"
                value={shippingCharged}
                onChange={(e) => setShippingCharged(e.target.value)}
                className={field}
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Payment ───────────────────────────────────────────────── */}
      <div className="admin-card p-4">
        <p className="mb-2 text-sm font-medium text-ink">Payment</p>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="payment"
              value="paid"
              checked={!invoice}
              onChange={() => setInvoice(false)}
              className="mt-1"
            />
            <span>
              Already paid
              <span className="block text-xs text-ink-soft">
                Cash, Venmo, card in person — just record it.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="payment"
              value="invoice"
              checked={invoice}
              onChange={() => setInvoice(true)}
              className="mt-1"
            />
            <span>
              Email an invoice to pay
              <span className="block text-xs text-ink-soft">
                Sends a friendly note with the order and four ways to pay —
                card, Venmo, Zelle or cash. It stays unpaid, and out of your
                sales totals, until you or Stripe says otherwise.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ── Bookkeeping ───────────────────────────────────────────── */}
      <div className="space-y-2 admin-card p-4">
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="decrement"
            checked={decrement}
            onChange={(e) => setDecrement(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Subtract from inventory
            <span className="block text-xs text-ink-soft">
              Uncheck if this item was never counted in stock.
            </span>
          </span>
        </label>
      </div>

      {/* ── Total ─────────────────────────────────────────────────── */}
      <div className="admin-card p-4 text-sm">
        <div className="ml-auto max-w-xs space-y-1">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>Discount{discountLabel ? ` (${discountLabel})` : ""}</span>
              <span>−${discount.toFixed(2)}</span>
            </div>
          )}
          {ship && (
            <div className="flex justify-between text-ink-soft">
              <span>Shipping</span>
              <span>
                {shippingNum === 0 ? "Free" : `$${shippingNum.toFixed(2)}`}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-ink">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        {invoice
          ? "They get a casual email with the order and four ways to pay: card, Venmo, Zelle or cash. If they pay you any way other than card, mark it paid on the order."
          : "No payment is charged — this only records a sale you’ve already been paid for, so it counts toward totals and inventory."}
      </p>

      {/* Carried to the server action so recording the sale retires the draft. */}
      <input type="hidden" name="draftId" value={draftId ?? ""} />

      <div className="admin-card p-4">
        <p className="mb-1 text-sm font-medium text-ink">
          Not ready to record it?
        </p>
        <p className="mb-3 text-xs text-ink-soft">
          Save it as a draft and finish later, from this or any other device.
          Nothing counts as a sale and no stock is held back until you record
          it.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Name it (optional)"
            className="w-56 rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand disabled:opacity-50"
          >
            {saving ? "Saving…" : draftId ? "Update draft" : "Save draft"}
          </button>
          {saveState.kind === "saved" && (
            <span className="text-sm text-sage-deep">Draft saved.</span>
          )}
          {saveState.kind === "error" && (
            <span className="text-sm text-red-700">{saveState.message}</span>
          )}
        </div>
      </div>

      <SubmitButton invoice={invoice} />
    </form>
  );
}
