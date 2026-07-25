"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Collection } from "@/data/collections";
import type { Variant } from "@/data/products";

export type ProductFormValues = {
  name: string;
  price: number;
  collection: string;
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
  const variantsText = (product?.variants ?? [])
    .map((v) => {
      const opts = v.options
        .map((o) => (v.prices?.[o] != null ? `${o}=${v.prices[o]}` : o))
        .join(", ");
      return `${v.name}: ${opts}`;
    })
    .join("\n");

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
            Collection
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

      <div>
        <label className="block text-sm font-medium text-ink">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={product?.description}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">
          Variants{" "}
          <span className="font-normal text-ink-soft">
            (one per line, e.g. <code>Color: Sage, Cream, Blush</code>; add{" "}
            <code>=price</code> to charge per option, e.g.{" "}
            <code>Size: S=13, M=14, L=15</code>)
          </span>
        </label>
        <textarea
          name="variants"
          rows={2}
          defaultValue={variantsText}
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
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={product?.stock ?? ""}
            className={field}
          />
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
