"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  checkPromoCode,
  createManualOrder,
} from "@/app/admin/(panel)/orders/new/actions";
import { SearchSelect } from "./SearchSelect";

export type PickerProduct = {
  slug: string;
  name: string;
  price: number; // dollars
  sizes: string[];
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

type Row = { slug: string; size: string; quantity: string; price: string };
type Promo = { code: string; label: string; discountCents: number };

const emptyRow: Row = { slug: "", size: "", quantity: "1", price: "" };

/** Records an off-site sale, or bills one by emailing an invoice. */
export function ManualOrderForm({
  products,
  customers,
}: {
  products: PickerProduct[];
  customers: PickerCustomer[];
}) {
  const [rows, setRows] = useState<Row[]>([emptyRow]);
  const [ship, setShip] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [shippingCharged, setShippingCharged] = useState("0");

  // Customer fields are controlled so picking a saved customer can fill them.
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal: "",
    country: "US",
  });

  const [codeInput, setCodeInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

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
  const discount = promo ? promo.discountCents / 100 : 0;
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
    <form action={createManualOrder} className="max-w-2xl space-y-5">
      {/* ── Items ─────────────────────────────────────────────────── */}
      <div className="admin-card p-4">
        <p className="mb-3 text-sm font-medium text-ink">Items</p>
        <div className="space-y-3">
          {rows.map((row, i) => {
            const p = productOf(row.slug);
            return (
              <div
                key={i}
                // The product column gets a floor: a bare 1fr collapses to
                // near-nothing beside the fixed-width number fields, and a
                // search box you can't read what you typed in is useless.
                className="grid grid-cols-2 gap-2 border-b border-border pb-3 last:border-0 sm:grid-cols-[minmax(13rem,1fr)_auto_auto_auto_auto]"
              >
                <label className="col-span-2 text-xs text-ink-soft sm:col-span-1">
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

                <div className="flex items-end pb-1">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRows((r) => r.filter((_, j) => j !== i));
                        setPromo(null);
                      }}
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
            <input name="notes" type="text" className={field} />
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
              Handed over in person
              <span className="block text-xs text-ink-soft">
                Pickup, a fair, a friend — nothing to post.
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
                Sends a pay-by-card link. The order stays unpaid, and out of
                your sales totals, until they pay.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* ── Bookkeeping ───────────────────────────────────────────── */}
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
        {!ship && !invoice && (
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="fulfilled" defaultChecked className="mt-0.5" />
            <span>
              Already handed over
              <span className="block text-xs text-ink-soft">
                Marks the order delivered so it doesn&apos;t show in “To ship”.
              </span>
            </span>
          </label>
        )}
      </div>

      {/* ── Total ─────────────────────────────────────────────────── */}
      <div className="admin-card p-4 text-sm">
        <div className="ml-auto max-w-xs space-y-1">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {promo && (
            <div className="flex justify-between text-ink-soft">
              <span>Discount ({promo.code})</span>
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
          ? "The customer gets an email with a secure card-payment link. Nothing is charged until they pay it."
          : "No payment is charged — this only records a sale you’ve already been paid for, so it counts toward totals and inventory."}
      </p>

      <SubmitButton invoice={invoice} />
    </form>
  );
}
