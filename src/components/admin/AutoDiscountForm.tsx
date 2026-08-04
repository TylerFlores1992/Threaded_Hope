"use client";

import { useActionState, useState } from "react";
import { createRule } from "@/app/admin/(panel)/discounts/actions";

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-sage-deep";

export function AutoDiscountForm() {
  const [state, action, pending] = useActionState(createRule, {});
  const [kind, setKind] = useState("quantity");
  const [discountType, setDiscountType] = useState("percent");

  return (
    <form action={action} className="max-w-lg space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink">Name</label>
        <input
          name="label"
          required
          placeholder="Buy 3, save 10%"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink">When</label>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={field}
          >
            <option value="quantity">Cart has at least … items</option>
            <option value="spend">Cart subtotal is at least … $</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            {kind === "spend" ? "Min subtotal ($)" : "Min items"}
          </label>
          <input
            name="threshold"
            type="number"
            min="1"
            step={kind === "spend" ? "0.01" : "1"}
            required
            placeholder={kind === "spend" ? "75" : "3"}
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink">Discount</label>
          <select
            name="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className={field}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Amount off ($)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            {discountType === "percent" ? "% off" : "$ off"}
          </label>
          <input
            name="value"
            type="number"
            min="1"
            step={discountType === "percent" ? "1" : "0.01"}
            required
            placeholder={discountType === "percent" ? "10" : "5"}
            className={field}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-sage-deep">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sage-deep px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create rule"}
      </button>
    </form>
  );
}
