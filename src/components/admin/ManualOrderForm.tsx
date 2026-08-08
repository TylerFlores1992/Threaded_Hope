"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createManualOrder } from "@/app/admin/(panel)/orders/new/actions";

export type PickerProduct = {
  slug: string;
  name: string;
  price: number; // dollars
  sizes: string[];
};

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage disabled:opacity-60"
    >
      {pending ? "Saving…" : "Record sale"}
    </button>
  );
}

type Row = { slug: string; size: string; quantity: string; price: string };

/** Records an off-site sale: pick products, set price/qty, save. */
export function ManualOrderForm({ products }: { products: PickerProduct[] }) {
  const [rows, setRows] = useState<Row[]>([
    { slug: "", size: "", quantity: "1", price: "" },
  ]);

  const productOf = (slug: string) => products.find((p) => p.slug === slug);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const onProduct = (i: number, slug: string) => {
    const p = productOf(slug);
    update(i, {
      slug,
      size: "",
      // Prefill the catalog price; still editable (friend price, discount…).
      price: p ? String(p.price) : "",
    });
  };

  const total = rows.reduce((sum, r) => {
    const qty = Math.max(1, Math.floor(Number(r.quantity) || 1));
    const price = Number(r.price);
    return sum + (Number.isFinite(price) ? price * qty : 0);
  }, 0);

  return (
    <form action={createManualOrder} className="max-w-2xl space-y-5">
      <div className="admin-card p-4">
        <p className="mb-3 text-sm font-medium text-ink">Items</p>
        <div className="space-y-3">
          {rows.map((row, i) => {
            const p = productOf(row.slug);
            return (
              <div
                key={i}
                className="grid grid-cols-2 gap-2 border-b border-border pb-3 last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto]"
              >
                <label className="col-span-2 text-xs text-ink-soft sm:col-span-1">
                  Product
                  <select
                    name="slug"
                    value={row.slug}
                    onChange={(e) => onProduct(i, e.target.value)}
                    required
                    className={field}
                  >
                    <option value="">Choose…</option>
                    {products.map((op) => (
                      <option key={op.slug} value={op.slug}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </label>

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

                <label className="text-xs text-ink-soft">
                  Qty
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    className={`${field} w-20`}
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
                    onChange={(e) => update(i, { price: e.target.value })}
                    className={`${field} w-28`}
                  />
                </label>

                <div className="flex items-end pb-1">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                      className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
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
          onClick={() =>
            setRows((r) => [...r, { slug: "", size: "", quantity: "1", price: "" }])
          }
          className="mt-3 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand"
        >
          + Add item
        </button>

        <p className="mt-4 text-right text-sm text-ink-soft">
          Items total:{" "}
          <span className="font-medium text-ink">${total.toFixed(2)}</span>
        </p>
      </div>

      <div className="grid gap-3 admin-card p-4 sm:grid-cols-2">
        <label className="text-xs text-ink-soft">
          Customer name (optional)
          <input name="customerName" type="text" className={field} />
        </label>
        <label className="text-xs text-ink-soft">
          Email (optional)
          <input name="email" type="email" className={field} />
        </label>
        <label className="text-xs text-ink-soft">
          Phone (optional)
          <input name="phone" type="tel" className={field} />
        </label>
        <label className="text-xs text-ink-soft">
          Shipping charged ($)
          <input
            name="shipping"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className={field}
          />
        </label>
        <label className="text-xs text-ink-soft">
          Note (e.g. paid cash / Venmo)
          <input name="notes" type="text" className={field} />
        </label>
      </div>

      <div className="space-y-2 admin-card p-4">
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" name="decrement" defaultChecked className="mt-0.5" />
          <span>
            Subtract from inventory
            <span className="block text-xs text-ink-soft">
              Uncheck if this item was never counted in stock.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" name="fulfilled" defaultChecked className="mt-0.5" />
          <span>
            Already handed over
            <span className="block text-xs text-ink-soft">
              Marks the order delivered so it doesn’t show in “To ship”.
            </span>
          </span>
        </label>
      </div>

      <p className="text-xs text-ink-soft">
        No payment is charged — this only records a sale you’ve already been paid
        for, so it counts toward totals and inventory.
      </p>

      <SubmitButton />
    </form>
  );
}
