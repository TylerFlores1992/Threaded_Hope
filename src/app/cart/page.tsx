"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { store } from "@/data/store";
import { ProductImage } from "@/components/ProductImage";
import { QtyStepper } from "@/components/CartDrawer";

export default function CartPage() {
  const { items, subtotal, setQty, remove } = useCart();

  const shipping =
    subtotal === 0 || subtotal >= store.shipping.freeThreshold
      ? 0
      : store.shipping.flatRate;
  const total = subtotal + shipping;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Your Cart</h1>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white/70 p-12 text-center ring-1 ring-border">
          <p className="text-ink-soft">Your cart is currently empty.</p>
          <Link
            href="/shop"
            className="mt-4 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y divide-border rounded-2xl bg-white/70 px-4 ring-1 ring-border">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-5">
                <ProductImage
                  name={item.name}
                  hue={item.hue}
                  className="h-24 w-24 flex-none rounded-lg object-cover ring-1 ring-border"
                />
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-medium text-ink hover:text-sage-deep"
                    >
                      {item.name}
                    </Link>
                    <span className="font-semibold text-sage-deep">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                  {Object.entries(item.options).length > 0 && (
                    <p className="text-xs text-ink-soft">
                      {Object.entries(item.options)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="text-sm text-ink-soft">{formatPrice(item.price)} each</p>
                  <div className="mt-auto flex items-center gap-4 pt-3">
                    <QtyStepper
                      value={item.quantity}
                      onChange={(q) => setQty(item.id, q)}
                      label={item.name}
                    />
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="text-sm text-ink-soft underline hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-2xl bg-white/70 p-6 ring-1 ring-border lg:sticky lg:top-24">
            <h2 className="font-serif text-xl text-ink">Order Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>
            <Link
              href="/checkout"
              className="mt-6 block rounded-full bg-sage-deep px-6 py-3 text-center text-sm font-semibold text-white hover:bg-sage"
            >
              Proceed to checkout
            </Link>
            <Link
              href="/shop"
              className="mt-2 block text-center text-sm text-sage-deep hover:underline"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
