import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { getPackagingOptions } from "@/lib/packaging";
import { addPackagingOption, deletePackagingOption } from "./actions";

export const dynamic = "force-dynamic";

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink";

export default async function PackagingPage() {
  const options = await getPackagingOptions();

  return (
    <div className="max-w-xl">
      <Link href="/admin/orders" className="text-sm text-ink-soft">
        ← Orders
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-ink">Packaging</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Presets you can pick when buying a label. The weight is the empty
        packaging (mailer/box + padding); it’s added to the item weights to
        estimate the parcel.
      </p>

      {!isDbConfigured() && (
        <p className="mb-4 rounded-lg bg-sand p-3 text-sm text-ink-soft">
          Connect a database to customize packaging. Defaults are shown for now.
        </p>
      )}

      <div className="divide-y divide-border admin-card">
        {options.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <span className="text-ink">{o.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-ink-soft">{o.weightOz} oz</span>
              <form action={deletePackagingOption.bind(null, o.id)}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
        {options.length === 0 && (
          <p className="px-4 py-3 text-sm text-ink-soft">No packaging yet.</p>
        )}
      </div>

      <form
        action={addPackagingOption}
        className="mt-5 admin-card p-4"
      >
        <p className="mb-3 text-sm font-medium text-ink">Add packaging</p>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className="text-xs text-ink-soft">
            Name
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Bubble mailer"
              className={field}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Weight (oz)
            <input
              name="weightOz"
              type="number"
              min="0"
              step="0.1"
              required
              className={field}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-lg bg-sage-deep px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Add
        </button>
      </form>
    </div>
  );
}
