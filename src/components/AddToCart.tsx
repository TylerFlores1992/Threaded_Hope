"use client";

import { useState } from "react";
import type { Product } from "@/data/products";
import { useCart, makeLineId } from "@/lib/cart-context";
import { resolveUnitPrice } from "@/lib/pricing";
import {
  sizeAxisOf,
  sizeSoldOut,
  optionSoldOut,
  isAvailable,
  defaultOption,
} from "@/lib/stock";
import { formatPrice } from "@/lib/format";
import { QtyStepper } from "./CartDrawer";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();

  const sizeAxis = sizeAxisOf(product);

  // Default each variant to its first option (first in-stock one on the size axis).
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((v) => [v.name, defaultOption(product, v)])),
  );
  const [qty, setQty] = useState(1);

  // Live price for the current selection (mirrors the server's checkout math).
  const unitPrice = resolveUnitPrice(product, selected);
  const available = isAvailable(product, selected);

  const addToCart = () => {
    if (!available) return;
    add(
      {
        id: makeLineId(product.slug, selected),
        slug: product.slug,
        name: product.name,
        price: unitPrice,
        hue: product.hue,
        options: selected,
      },
      qty,
    );
  };

  return (
    <div className="mt-6 space-y-5">
      {product.variants.map((variant) => (
        <div key={variant.name}>
          <span className="text-sm font-semibold text-ink">{variant.name}</span>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={variant.name}>
            {variant.options.map((option) => {
              const active = selected[variant.name] === option;
              const optionPrice = variant.prices?.[option];
              // Sizes come off the size axis; every other group (colour, style)
              // has its own tracked counts.
              const soldOut =
                sizeAxis?.name === variant.name
                  ? sizeSoldOut(product, option)
                  : optionSoldOut(product, variant.name, option);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  disabled={soldOut}
                  onClick={() =>
                    setSelected((prev) => ({ ...prev, [variant.name]: option }))
                  }
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    soldOut
                      ? "cursor-not-allowed border-border bg-sand text-ink-soft line-through opacity-60"
                      : active
                        ? "border-sage-deep bg-sage-deep text-white"
                        : "border-border bg-white text-ink hover:border-sage"
                  }`}
                >
                  {option}
                  {optionPrice != null && (
                    <span className={active && !soldOut ? "text-white/80" : "text-ink-soft"}>
                      {" "}
                      · {formatPrice(optionPrice)}
                    </span>
                  )}
                  {soldOut && <span className="ml-1 text-xs">(sold out)</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {available && (
        <p className="text-lg font-semibold text-sage-deep" aria-live="polite">
          {formatPrice(unitPrice)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="sr-only">Quantity</span>
          <QtyStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} label={product.name} />
        </div>
        <button
          type="button"
          onClick={addToCart}
          disabled={!available}
          className="flex-1 rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:cursor-not-allowed disabled:bg-taupe"
        >
          {available ? "Add to cart" : "Sold out"}
        </button>
      </div>
    </div>
  );
}
