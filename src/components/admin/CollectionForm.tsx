"use client";

import { useFormStatus } from "react-dom";
import type { Collection } from "@/data/collections";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-sage-deep";

export function CollectionForm({
  action,
  collection,
  submitLabel = "Save collection",
  sortMode = "manual",
  sortModes = [],
  seoTitle,
  seoDescription,
}: {
  action: (formData: FormData) => void | Promise<void>;
  collection?: Collection;
  submitLabel?: string;
  /** How products order on the collection page. */
  sortMode?: string;
  sortModes?: readonly { id: string; label: string }[];
  seoTitle?: string | null;
  seoDescription?: string | null;
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink">Name</label>
        <input name="name" required defaultValue={collection?.name} className={field} />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={collection?.description}
          className={field}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">
          Accent hue{" "}
          <span className="font-normal text-ink-soft">
            (0–360 — tints the placeholder image when a collection has no photo)
          </span>
        </label>
        <input
          name="hue"
          type="number"
          min="0"
          max="360"
          step="1"
          defaultValue={collection?.hue ?? 145}
          className={field}
        />
      </div>

      {sortModes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-ink">
            Sort products by
          </label>
          <select name="sortMode" defaultValue={sortMode} className={field}>
            {sortModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="admin-card p-4">
        <legend className="px-1 text-sm font-medium text-ink">
          Search engine listing{" "}
          <span className="font-normal text-ink-soft">
            (blank = use the name and description)
          </span>
        </legend>
        <label className="mt-2 block text-sm text-ink-soft">
          Page title
          <input
            name="seoTitle"
            defaultValue={seoTitle ?? ""}
            maxLength={70}
            placeholder={collection?.name}
            className={field}
          />
        </label>
        <label className="mt-3 block text-sm text-ink-soft">
          Meta description
          <textarea
            name="seoDescription"
            rows={2}
            defaultValue={seoDescription ?? ""}
            maxLength={160}
            placeholder={collection?.description}
            className={field}
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={collection?.featured ?? false}
          />
          Featured (shown in “Shop by collection” on the home page)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="hidden"
            defaultChecked={collection?.hidden ?? false}
          />
          Hidden (kept off the storefront)
        </label>
      </div>

      <div className="pt-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
