"use client";

import { useActionState } from "react";
import { createDiscount } from "@/app/admin/(panel)/discounts/actions";

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-sage-deep";

export function DiscountForm() {
  const [state, action, pending] = useActionState(createDiscount, {});

  return (
    <form action={action} className="max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink">Code</label>
          <input
            name="code"
            required
            placeholder="WELCOME10"
            className={`${field} uppercase`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">% off</label>
          <input
            name="percent"
            type="number"
            min="1"
            max="100"
            required
            placeholder="10"
            className={field}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink">Applies</label>
        <select name="duration" defaultValue="once" className={field}>
          <option value="once">Once per customer</option>
          <option value="forever">Every order</option>
        </select>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-sage-deep">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-sage-deep px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create discount"}
      </button>
    </form>
  );
}
