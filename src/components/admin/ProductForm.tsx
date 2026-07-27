"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Collection } from "@/data/collections";
import type { Variant } from "@/data/products";
import { sizeAxisOf } from "@/lib/stock";

type SizeRow = { label: string; price: string };

export type ProductFormValues = {
  name: string;
  price: number;
  collection: string;
  collections: string[];
  description: string;
  variants: Variant[];
  inStock: boolean;
  featured: boolean;
  stock: number | null;
  image?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-sage-deep";

export function ProductForm({
  action,
  collections,
  product,
  submitLabel = "Save product",
}: {
  action: (formData: FormData) => void | Promise<void>;
  collections: Collection[];
  product?: ProductFormValues;
  submitLabel?: string;
}) {
  const [preview, setPreview] = useState<string | undefined>(product?.image);

  // Split existing variants into the size axis (structured editor below) and
  // any other option groups (color, etc. — kept in the free-text field).
  const allVariants = product?.variants ?? [];
  const sizeAxis = sizeAxisOf({ variants: allVariants });
  const [hasSizes, setHasSizes] = useState<boolean>(!!sizeAxis);
  const [sizeRows, setSizeRows] = useState<SizeRow[]>(
    sizeAxis
      ? sizeAxis.options.map((o) => ({
          label: o,
          price: sizeAxis.prices?.[o] != null ? String(sizeAxis.prices[o]) : "",
        }))
      : [{ label: "", price: "" }],
  );

  const otherVariantsText = allVariants
    .filter((v) => v !== sizeAxis)
    .map((v) => `${v.name}: ${v.options.join(", ")}`)
    .join("\n");

  const updateRow = (i: number, patch: Partial<SizeRow>) =>
    setSizeRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setSizeRows((rows) => [...rows, { label: "", price: "" }]);
  const removeRow = (i: number) =>
    setSizeRows((rows) => rows.filter((_, j) => j !== i));

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink">Name</label>
        <input
          name="name"
          required
          defaultValue={product?.name}
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">
            Price (USD)
          </label>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.price}
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Primary collection
          </label>
          <select
            name="collectionSlug"
            required
            defaultValue={product?.collection ?? ""}
            className={field}
          >
            <option value="" disabled>
              Choose…
            </option>
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-ink">
          Also list in{" "}
          <span className="font-normal text-ink-soft">
            (optional — the product shows in each checked collection; the primary
            above drives its breadcrumb)
          </span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {collections.map((c) => (
            <label
              key={c.slug}
              className="flex cursor-pointer items-center gap-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                name="collections"
                value={c.slug}
                defaultChecked={product?.collections?.includes(c.slug) ?? false}
                className="h-4 w-4 accent-sage-deep"
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-ink">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={product?.description}
          className={field}
        />
      </div>

      {/* Sizes — structured editor. Feeds per-size price + per-size inventory. */}
      <fieldset className="rounded-2xl bg-white/60 p-4 ring-1 ring-border">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            name="hasSizes"
            checked={hasSizes}
            onChange={(e) => setHasSizes(e.target.checked)}
            className="h-4 w-4 accent-sage-deep"
          />
          This product comes in sizes
        </label>

        {hasSizes && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 text-xs font-medium text-ink-soft">
              <span className="flex-1">Size</span>
              <span className="w-28">Price ($, optional)</span>
              <span className="w-8" />
            </div>
            {sizeRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  name="sizeLabel"
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="e.g. Small"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sage-deep"
                />
                <input
                  name="sizePrice"
                  value={row.price}
                  onChange={(e) => updateRow(i, { price: e.target.value })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="—"
                  className="w-28 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sage-deep"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Remove size"
                  className="w-8 rounded-lg py-2 text-ink-soft hover:bg-sand hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-sage-deep hover:underline"
            >
              + Add size
            </button>
            <p className="text-xs text-ink-soft">
              Leave a price blank to use the base price above. Stock for each size
              is set on the Inventory page after saving.
            </p>
          </div>
        )}
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-ink">
          Other options{" "}
          <span className="font-normal text-ink-soft">
            (non-size choices like color — one group per line, e.g.{" "}
            <code>Color: Sage, Cream, Blush</code>)
          </span>
        </label>
        <textarea
          name="variants"
          rows={2}
          defaultValue={otherVariantsText}
          placeholder="Color: Sage, Cream, Blush"
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">
            Stock{" "}
            <span className="font-normal text-ink-soft">(blank = untracked)</span>
          </label>
          {hasSizes ? (
            <p className="mt-1 rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">
              Stock is tracked per size on the{" "}
              <span className="font-medium text-ink">Inventory</span> page.
            </p>
          ) : (
            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.stock ?? ""}
              className={field}
            />
          )}
        </div>
        <div className="flex items-end gap-6 pb-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="inStock"
              defaultChecked={product ? product.inStock : true}
            />
            In stock
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={product?.featured ?? false}
            />
            Featured
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Photo</label>
        <p className="text-xs text-ink-soft">
          Optional. Leave blank to keep the current image / use a placeholder.
        </p>
        <div className="mt-2 flex items-center gap-4">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-20 w-20 rounded-lg object-cover ring-1 ring-border"
            />
          )}
          <input
            name="image"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : product?.image);
            }}
            className="text-sm text-ink-soft"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
