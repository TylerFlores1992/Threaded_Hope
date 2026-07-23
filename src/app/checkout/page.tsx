"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { store } from "@/data/store";

/*
 * Multi-step checkout with client-side validation and a MOCK payment step.
 * ── PLUG IN A REAL PROCESSOR HERE ──
 * The `placeOrder` function is where you'd call your backend / Stripe. The
 * payment step is intentionally stubbed (no card data leaves the browser).
 * See README for the Stripe integration outline.
 */

type Errors = Record<string, string>;

const STEPS = ["Shipping", "Payment", "Review"] as const;

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [placed, setPlaced] = useState(false);

  const [shipping, setShipping] = useState({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [payment, setPayment] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  const shippingCost =
    subtotal >= store.shipping.freeThreshold ? 0 : store.shipping.flatRate;
  const total = subtotal + shippingCost;

  const validateShipping = () => {
    const e: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email))
      e.email = "Enter a valid email.";
    if (!shipping.firstName.trim()) e.firstName = "Required.";
    if (!shipping.lastName.trim()) e.lastName = "Required.";
    if (!shipping.address.trim()) e.address = "Required.";
    if (!shipping.city.trim()) e.city = "Required.";
    if (!shipping.state.trim()) e.state = "Required.";
    if (!/^\d{5}(-\d{4})?$/.test(shipping.zip)) e.zip = "Enter a valid ZIP.";
    return e;
  };

  const validatePayment = () => {
    const e: Errors = {};
    if (!payment.cardName.trim()) e.cardName = "Required.";
    if (payment.cardNumber.replace(/\s/g, "").length < 12)
      e.cardNumber = "Enter a valid card number.";
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(payment.expiry))
      e.expiry = "Use MM/YY.";
    if (!/^\d{3,4}$/.test(payment.cvc)) e.cvc = "3–4 digits.";
    return e;
  };

  const next = () => {
    const e = step === 0 ? validateShipping() : step === 1 ? validatePayment() : {};
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const placeOrder = () => {
    // MOCK: pretend the order succeeded. Swap for a real API/Stripe call.
    setPlaced(true);
    clear();
  };

  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage-deep text-3xl text-white">
          ✓
        </div>
        <h1 className="mt-6 font-serif text-3xl text-ink">Thank you for your order!</h1>
        <p className="mt-3 text-ink-soft">
          A confirmation has been sent to your email. We&apos;ll stitch it up and
          ship it with care. 🌿
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Checkout</h1>

      {/* Step indicator */}
      <ol className="mt-6 flex items-center gap-2 text-sm" aria-label="Checkout progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                i <= step ? "bg-sage-deep text-white" : "bg-sand text-ink-soft"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span className={i === step ? "font-semibold text-ink" : "text-ink-soft"}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 text-taupe">→</span>}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white/70 p-6 ring-1 ring-border">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-ink">Shipping details</h2>
              <Field label="Email" id="email" error={errors.email}>
                <input
                  {...inputProps("email", shipping, setShipping)}
                  type="email"
                  autoComplete="email"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" id="firstName" error={errors.firstName}>
                  <input {...inputProps("firstName", shipping, setShipping)} autoComplete="given-name" />
                </Field>
                <Field label="Last name" id="lastName" error={errors.lastName}>
                  <input {...inputProps("lastName", shipping, setShipping)} autoComplete="family-name" />
                </Field>
              </div>
              <Field label="Address" id="address" error={errors.address}>
                <input {...inputProps("address", shipping, setShipping)} autoComplete="street-address" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" id="city" error={errors.city}>
                  <input {...inputProps("city", shipping, setShipping)} autoComplete="address-level2" />
                </Field>
                <Field label="State" id="state" error={errors.state}>
                  <input {...inputProps("state", shipping, setShipping)} autoComplete="address-level1" />
                </Field>
                <Field label="ZIP" id="zip" error={errors.zip}>
                  <input {...inputProps("zip", shipping, setShipping)} autoComplete="postal-code" inputMode="numeric" />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-ink">Payment</h2>
              <div className="rounded-lg bg-gold/15 px-4 py-3 text-sm text-gold-deep">
                🔒 <strong>Demo mode:</strong> this is a mock payment step. No card is
                charged and no data is stored. Use any test values to continue.
              </div>
              <Field label="Name on card" id="cardName" error={errors.cardName}>
                <input {...inputProps("cardName", payment, setPayment)} autoComplete="cc-name" />
              </Field>
              <Field label="Card number" id="cardNumber" error={errors.cardNumber}>
                <input
                  {...inputProps("cardNumber", payment, setPayment)}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  autoComplete="cc-number"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Expiry (MM/YY)" id="expiry" error={errors.expiry}>
                  <input {...inputProps("expiry", payment, setPayment)} placeholder="12/28" autoComplete="cc-exp" />
                </Field>
                <Field label="CVC" id="cvc" error={errors.cvc}>
                  <input {...inputProps("cvc", payment, setPayment)} placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-serif text-xl text-ink">Review your order</h2>
              <div className="rounded-lg bg-sand p-4 text-sm">
                <p className="font-semibold text-ink">Shipping to</p>
                <p className="text-ink-soft">
                  {shipping.firstName} {shipping.lastName}
                  <br />
                  {shipping.address}
                  <br />
                  {shipping.city}, {shipping.state} {shipping.zip}
                  <br />
                  {shipping.email}
                </p>
              </div>
              <div className="rounded-lg bg-sand p-4 text-sm">
                <p className="font-semibold text-ink">Payment</p>
                <p className="text-ink-soft">
                  {payment.cardName} · card ending{" "}
                  {payment.cardNumber.replace(/\s/g, "").slice(-4) || "••••"}
                </p>
              </div>
              <ul className="divide-y divide-border text-sm">
                {items.map((item) => (
                  <li key={item.id} className="flex justify-between py-2">
                    <span className="text-ink-soft">
                      {item.name} × {item.quantity}
                    </span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-border hover:bg-sand"
              >
                ← Back
              </button>
            ) : (
              <Link
                href="/cart"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-border hover:bg-sand"
              >
                ← Cart
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-sage-deep px-6 py-2.5 text-sm font-semibold text-white hover:bg-sage"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={placeOrder}
                className="rounded-full bg-sage-deep px-6 py-2.5 text-sm font-semibold text-white hover:bg-sage"
              >
                Place order · {formatPrice(total)}
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-2xl bg-white/70 p-6 ring-1 ring-border lg:sticky lg:top-24">
          <h2 className="font-serif text-xl text-ink">Order Summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="text-ink-soft">
                  {item.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Shipping</dt>
              <dd>{shippingCost === 0 ? "Free" : formatPrice(shippingCost)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

/* ── small form helpers ── */

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function inputProps<T extends Record<string, string>>(
  name: keyof T & string,
  state: T,
  setState: React.Dispatch<React.SetStateAction<T>>,
) {
  return {
    id: name,
    name,
    value: state[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setState((prev) => ({ ...prev, [name]: e.target.value })),
    className:
      "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-sage-deep",
  };
}
