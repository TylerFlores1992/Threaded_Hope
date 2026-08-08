"use client";

import { useState, useTransition } from "react";
import { backfillFromStripe } from "@/app/admin/(panel)/orders/actions";

/**
 * Fills in customer details Stripe has but we never stored — orders taken
 * before the webhook read the collected shipping details show a bare email
 * where the name belongs.
 *
 * Only fills blanks, so it's safe to press twice.
 */
export function BackfillFromStripe() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => start(async () => setResult(await backfillFromStripe()))}
        disabled={pending}
        title="Reads names, phones and addresses back from Stripe for older orders"
        className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03] disabled:opacity-50"
      >
        {pending ? "Checking Stripe…" : "Fill in missing details"}
      </button>
      {result && (
        <span
          className={`text-[12px] ${result.ok ? "text-[#0c5132]" : "text-[#8e1f0b]"}`}
        >
          {result.message}
        </span>
      )}
    </span>
  );
}
