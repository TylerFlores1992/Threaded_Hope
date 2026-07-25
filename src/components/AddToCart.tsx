"use client";

import { useState } from "react";
import type { Product } from "@/data/products";
import { useCart, makeLineId } from "@/lib/cart-context";
import { resolveUnitPrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import { QtyStepper } from "./CartDrawer";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();

  // Default each variant to its first option.
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((v) => [v.name, v.options[0]])),
  );
  const [qty, setQty] = useState(1);

  // Live price for the current selection (mirrors the server's checkout math).
  const unitPrice = resolveUnitPrice(product, selected);

  const addToCart = () => {
    if (!product.inStock) return;
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
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelected((prev) => ({ ...prev, [variant.name]: option }))
                  }
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    active
                      ? "border-sage-deep bg-sage-deep text-white"
                      : "border-border bg-white text-ink hover:border-sage"
                  }`}
                >
                  {option}
                  {optionPrice != null && (
                    <span className={active ? "text-white/80" : "text-ink-soft"}>
                      {" "}
                      · {formatPrice(optionPrice)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {product.inStock && (
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
          disabled={!product.inStock}
          className="flex-1 rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:cursor-not-allowed disabled:bg-taupe"
        >
          {product.inStock ? "Add to cart" : "Sold out"}
        </button>
      </div>
    </div>
  );
}
