"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";

export default function CheckoutSuccessPage() {
  const { clear } = useCart();

  // The order is paid at this point — empty the cart.
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage-deep text-3xl text-white">
        ✓
      </div>
      <h1 className="mt-6 font-serif text-3xl text-ink">Thank you for your order!</h1>
      <p className="mt-3 text-ink-soft">
        Your payment was successful and a receipt is on its way to your email.
        We&apos;ll stitch it up and ship it with care. 🌿
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
