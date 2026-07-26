"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { store } from "@/data/store";
import { ProductImage } from "./ProductImage";

export function CartDrawer() {
  const { isOpen, closeCart, items, subtotal, setQty, remove, count } = useCart();

  // Lock body scroll & allow Esc to close while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  const remaining = store.shipping.freeThreshold - subtotal;

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeCart}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-serif text-xl">Your Cart ({count})</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="rounded-lg p-2 hover:bg-sand"
          >
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-ink-soft">Your cart is empty.</p>
            <Link
              href="/shop"
              onClick={closeCart}
              className="rounded-full bg-sage-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 py-4">
                  <ProductImage
                    name={item.name}
                    hue={item.hue}
                    className="h-20 w-20 flex-none rounded-lg object-cover ring-1 ring-border"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-2">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={closeCart}
                        className="font-medium text-ink hover:text-sage-deep"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="text-ink-soft hover:text-red-700"
                      >
                        <CloseIcon small />
                      </button>
                    </div>
                    {Object.entries(item.options).length > 0 && (
                      <p className="text-xs text-ink-soft">
                        {Object.entries(item.options)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QtyStepper
                        value={item.quantity}
                        onChange={(q) => setQty(item.id, q)}
                        label={item.name}
                      />
                      <span className="font-semibold text-sage-deep">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border p-5">
              {remaining > 0 ? (
                <p className="mb-3 text-center text-xs text-ink-soft">
                  You&apos;re {formatPrice(remaining)} away from free shipping!
                </p>
              ) : (
                <p className="mb-3 text-center text-xs font-medium text-sage-deep">
                  You&apos;ve unlocked free shipping!
                </p>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Shipping &amp; taxes calculated at checkout.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="rounded-full bg-sage-deep px-5 py-3 text-center text-sm font-semibold text-white hover:bg-sage"
                >
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-ink ring-1 ring-border hover:bg-sand"
                >
                  View cart
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center rounded-full ring-1 ring-border">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label={`Decrease quantity of ${label}`}
        className="px-3 py-1 text-ink hover:text-sage-deep"
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`Increase quantity of ${label}`}
        className="px-3 py-1 text-ink hover:text-sage-deep"
      >
        +
      </button>
    </div>
  );
}

function CloseIcon({ small = false }: { small?: boolean }) {
  const s = small ? 16 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
