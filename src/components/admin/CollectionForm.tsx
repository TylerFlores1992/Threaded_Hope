"use client";

import { useFormStatus } from "react-dom";
import type { Collection } from "@/data/collections";

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

export function CollectionForm({
  action,
  collection,
  submitLabel = "Save collection",
}: {
  action: (formData: FormData) => void | Promise<void>;
  collection?: Collection;
  submitLabel?: string;
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
