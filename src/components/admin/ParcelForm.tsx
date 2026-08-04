"use client";

import { useState } from "react";
import Link from "next/link";
import type { PackagingOption } from "@/lib/packaging";

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink";

/**
 * Parcel entry for the buy-label page. Picking a packaging preset adds its tare
 * weight to the ordered items' weight and prefills the parcel weight (until the
 * user overrides it). Submits via GET so the server page fetches fresh rates.
 */
export function ParcelForm({
  itemsWeight,
  anyWeightKnown,
  packagingOptions,
  initial,
}: {
  itemsWeight: number;
  anyWeightKnown: boolean;
  packagingOptions: PackagingOption[];
  initial: {
    length: string;
    width: string;
    height: string;
    weight: string;
    packaging: string;
  };
}) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const firstId = packagingOptions[0]?.id ?? "";
  const [packaging, setPackaging] = useState(initial.packaging || firstId);
  const pkgWeight = (id: string) =>
    packagingOptions.find((o) => o.id === id)?.weightOz ?? 0;

  const computed = round1(Math.max(1, itemsWeight + pkgWeight(packaging)));
  const [weight, setWeight] = useState(
    initial.weight || (anyWeightKnown || firstId ? String(computed) : ""),
  );
  const [weightTouched, setWeightTouched] = useState(Boolean(initial.weight));

  const onPackaging = (id: string) => {
    setPackaging(id);
    if (!weightTouched) {
      setWeight(String(round1(Math.max(1, itemsWeight + pkgWeight(id)))));
    }
  };

  return (
    <form method="get" className="admin-card p-4">
      <p className="mb-3 text-sm font-medium text-ink">Parcel</p>

      <div className="mb-3 flex items-end gap-2">
        <label className="flex-1 text-xs text-ink-soft">
          Packaging
          <select
            name="packaging"
            value={packaging}
            onChange={(e) => onPackaging(e.target.value)}
            className={field}
          >
            {packagingOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.weightOz} oz)
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/admin/orders/packaging"
          className="mb-1 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:bg-sand"
        >
          Manage packaging
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-ink-soft">
          Length (in)
          <input name="length" type="number" min="1" step="0.1" defaultValue={initial.length || "9"} className={field} />
        </label>
        <label className="text-xs text-ink-soft">
          Width (in)
          <input name="width" type="number" min="1" step="0.1" defaultValue={initial.width || "6"} className={field} />
        </label>
        <label className="text-xs text-ink-soft">
          Height (in)
          <input name="height" type="number" min="1" step="0.1" defaultValue={initial.height || "2"} className={field} />
        </label>
        <label className="text-xs text-ink-soft">
          Weight (oz)
          <input
            name="weight"
            type="number"
            min="1"
            step="0.1"
            placeholder="Enter oz"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              setWeightTouched(true);
            }}
            className={field}
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        {anyWeightKnown
          ? `Prefilled from product weights (${round1(itemsWeight)} oz) + packaging. Verify before buying.`
          : "Tip: set per-product weights in the product editor to auto-fill items. Weight shown is packaging only — add item weight and verify."}
      </p>

      <button
        type="submit"
        className="mt-4 rounded-lg bg-sage-deep px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Get rates
      </button>
    </form>
  );
}
