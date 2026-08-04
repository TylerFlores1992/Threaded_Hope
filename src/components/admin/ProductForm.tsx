"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { upload } from "@vercel/blob/client";
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
  weightOz: number | null;
  image?: string;
  images?: string[];
};

function SubmitButton({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
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
  inventoryEditor,
}: {
  action: (formData: FormData) => void | Promise<void>;
  collections: Collection[];
  product?: ProductFormValues;
  submitLabel?: string;
  /** Live inventory controls (edit page) rendered in place of the stock field. */
  inventoryEditor?: ReactNode;
}) {
  const existingImages =
    product?.images && product.images.length > 0
      ? product.images
      : product?.image
        ? [product.image]
        : [];
  // Photos are uploaded to Blob storage as soon as they're picked, so the form
  // only ever submits URLs — a phone photo never has to fit in a request body.
  const [images, setImages] = useState<string[]>(existingImages);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadError(null);
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        setImages((prev) => [...prev, blob.url]);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "That photo couldn't upload.",
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const removeImage = (url: string) =>
    setImages((prev) => prev.filter((u) => u !== url));
  const makeMain = (url: string) =>
    setImages((prev) => [url, ...prev.filter((u) => u !== url)]);

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

  const updateRow = (i: number, patch: Partial<SizeRow>) =>
    setSizeRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setSizeRows((rows) => [...rows, { label: "", price: "" }]);
  const removeRow = (i: number) =>
    setSizeRows((rows) => rows.filter((_, j) => j !== i));

  // Non-size option groups (color, style, …) — structured, no prices.
  const [optionGroups, setOptionGroups] = useState<
    { name: string; values: string[] }[]
  >(
    allVariants
      .filter((v) => v !== sizeAxis)
      .map((v) => ({ name: v.name, values: v.options.length ? v.options : [""] })),
  );
  const setGroupName = (gi: number, name: string) =>
    setOptionGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, name } : g)));
  const addGroup = () =>
    setOptionGroups((gs) => [...gs, { name: "", values: [""] }]);
  const removeGroup = (gi: number) =>
    setOptionGroups((gs) => gs.filter((_, i) => i !== gi));
  const setValue = (gi: number, vi: number, val: string) =>
    setOptionGroups((gs) =>
      gs.map((g, i) =>
        i === gi
          ? { ...g, values: g.values.map((v, j) => (j === vi ? val : v)) }
          : g,
      ),
    );
  const addValue = (gi: number) =>
    setOptionGroups((gs) =>
      gs.map((g, i) => (i === gi ? { ...g, values: [...g.values, ""] } : g)),
    );
  const removeValue = (gi: number, vi: number) =>
    setOptionGroups((gs) =>
      gs.map((g, i) =>
        i === gi ? { ...g, values: g.values.filter((_, j) => j !== vi) } : g,
      ),
    );

  // Serialized for the server action (drop empty names/values).
  const otherOptionsJson = JSON.stringify(
    optionGroups
      .map((g) => ({
        name: g.name.trim(),
        options: g.values.map((v) => v.trim()).filter(Boolean),
      }))
      .filter((g) => g.name && g.options.length > 0),
  );

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

      {/* Other options (color, style, …) — structured groups, no prices. */}
      <fieldset className="rounded-2xl bg-white/60 p-4 ring-1 ring-border">
        <legend className="px-1 text-sm font-medium text-ink">
          Other options{" "}
          <span className="font-normal text-ink-soft">
            (non-size choices like color — each gets its own tracked stock)
          </span>
        </legend>
        <input type="hidden" name="otherOptions" value={otherOptionsJson} />

        <div className="mt-2 space-y-4">
          {optionGroups.map((group, gi) => (
            <div key={gi} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <input
                  value={group.name}
                  onChange={(e) => setGroupName(gi, e.target.value)}
                  placeholder="Option name (e.g. Color)"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-sage-deep"
                />
                <button
                  type="button"
                  onClick={() => removeGroup(gi)}
                  className="rounded-lg px-2 py-2 text-xs text-ink-soft hover:bg-sand hover:text-red-700"
                >
                  Remove group
                </button>
              </div>
              <div className="mt-2 space-y-2 pl-1">
                {group.values.map((val, vi) => (
                  <div key={vi} className="flex items-center gap-2">
                    <input
                      value={val}
                      onChange={(e) => setValue(gi, vi, e.target.value)}
                      placeholder="e.g. Sage"
                      className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sage-deep"
                    />
                    <button
                      type="button"
                      onClick={() => removeValue(gi, vi)}
                      aria-label="Remove value"
                      className="w-8 rounded-lg py-1.5 text-ink-soft hover:bg-sand hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addValue(gi)}
                  className="text-sm font-medium text-sage-deep hover:underline"
                >
                  + Add choice
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addGroup}
            className="text-sm font-medium text-sage-deep hover:underline"
          >
            + Add option group
          </button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">
            {inventoryEditor ? "Inventory" : "Stock"}{" "}
            <span className="font-normal text-ink-soft">(blank = untracked)</span>
          </label>
          {inventoryEditor ? (
            <div className="mt-1">{inventoryEditor}</div>
          ) : hasSizes || optionGroups.length > 0 ? (
            <p className="mt-1 rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">
              Stock is tracked per choice (size, colour, …). Set the counts on
              the <span className="font-medium text-ink">Inventory</span> page
              after saving.
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
        <div>
          <label className="block text-sm font-medium text-ink">
            Weight (oz){" "}
            <span className="font-normal text-ink-soft">
              (per unit, for shipping)
            </span>
          </label>
          <input
            name="weightOz"
            type="number"
            min="0"
            step="0.1"
            defaultValue={product?.weightOz ?? ""}
            className={field}
          />
        </div>
        <div className="flex items-end gap-6 pb-2">
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
        <label className="block text-sm font-medium text-ink">Photos</label>
        <p className="text-xs text-ink-soft">
          The first photo is the main image. Add several to build a gallery.
          Photos upload as soon as you pick them — save to apply the changes.
        </p>

        {images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {images.map((url, i) => (
              <div key={url} className="relative">
                {/* The gallery, in order — the server rebuilds it from these. */}
                <input type="hidden" name="keepImage" value={url} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover ring-1 ring-border"
                />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-sage-deep px-1 text-[10px] font-medium text-white">
                    Main
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeMain(url)}
                    className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[10px] font-medium text-ink-soft hover:text-sage-deep"
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs text-ink-soft hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = ""; // allow re-picking the same file
            }}
            className="text-sm text-ink-soft"
          />
          {uploading > 0 && (
            <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
              Uploading {uploading} photo{uploading === 1 ? "" : "s"}…
            </p>
          )}
          {uploadError && (
            <p className="mt-2 text-sm text-red-700">{uploadError}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={submitLabel} disabled={uploading > 0} />
      </div>
    </form>
  );
}
