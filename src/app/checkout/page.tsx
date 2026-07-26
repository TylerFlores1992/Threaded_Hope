"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { store } from "@/data/store";
import { ProductImage } from "@/components/ProductImage";

/*
 * Checkout hands off to Stripe's secure, hosted payment page.
 * We POST the cart to /api/checkout, which builds a Stripe Checkout Session
 * (pricing is recomputed server-side) and returns a URL we redirect to.
 * Stripe collects the card, email, and shipping address; on success the
 * shopper returns to /checkout/success. See README for key setup.
 */
export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const shippingCost =
    subtotal >= store.shipping.freeThreshold ? 0 : store.shipping.flatRate;
  const total = subtotal + shippingCost;

  const payWithStripe = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            slug: i.slug,
            quantity: i.quantity,
            options: i.options,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout is unavailable right now.");
        setLoading(false);
        return;
      }
      window.location.href = data.url; // hand off to Stripe
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-serif text-3xl text-ink">Your cart is empty</h1>
        <p className="mt-3 text-ink-soft">Add a few handmade goodies to check out.</p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
        >
          Shop products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Checkout</h1>
      <p className="mt-2 text-ink-soft">
        Review your order below, then continue to our secure payment partner to
        enter your shipping and payment details.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Order review */}
        <ul className="divide-y divide-border rounded-2xl bg-white/70 px-4 ring-1 ring-border">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 py-5">
              <ProductImage
                name={item.name}
                hue={item.hue}
                className="h-20 w-20 flex-none rounded-lg object-cover ring-1 ring-border"
              />
              <div className="flex flex-1 flex-col">
                <span className="font-medium text-ink">{item.name}</span>
                {Object.entries(item.options).length > 0 && (
                  <span className="text-xs text-ink-soft">
                    {Object.entries(item.options)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </span>
                )}
                <span className="text-sm text-ink-soft">Qty {item.quantity}</span>
              </div>
              <span className="font-semibold text-sage-deep">
                {formatPrice(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {/* Summary + pay */}
        <aside className="h-fit rounded-2xl bg-white/70 p-6 ring-1 ring-border">
          <h2 className="font-serif text-xl text-ink">Order Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Shipping</dt>
              <dd>{shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Estimated total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">
            Taxes calculated by our payment partner at checkout.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={payWithStripe}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:cursor-not-allowed disabled:bg-taupe"
          >
            {loading ? "Redirecting…" : "Pay securely →"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-ink-soft">
            Secure payment powered by Stripe
          </p>
          <Link
            href="/cart"
            className="mt-3 block text-center text-sm text-sage-deep hover:underline"
          >
            ← Back to cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
