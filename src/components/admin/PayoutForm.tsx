"use client";

import { useState, useTransition } from "react";
import { createPayout } from "@/app/admin/(panel)/stripe/actions";

/**
 * Move the available balance to the bank. Real money leaves Stripe here, so it
 * confirms first and reports back whatever Stripe says.
 */
export function PayoutForm({ availableCents }: { availableCents: number }) {
  const [amount, setAmount] = useState((availableCents / 100).toFixed(2));
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setResult({ ok: false, message: "Enter an amount greater than zero." });
      return;
    }
    if (
      !window.confirm(
        `Pay out $${(cents / 100).toFixed(2)} to your bank account?`,
      )
    ) {
      return;
    }
    start(async () => setResult(await createPayout(cents)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center rounded-lg border border-border bg-white px-2 py-1.5 text-[13px]">
          <span className="text-ink-soft">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Payout amount"
            className="w-28 bg-transparent px-1 outline-none"
          />
        </span>
        <button
          onClick={submit}
          disabled={pending || availableCents <= 0}
          className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-50"
        >
          {pending ? "Starting…" : "Pay out to bank"}
        </button>
      </div>
      {result && (
        <p
          className={`mt-3 rounded-lg p-3 text-[13px] ${
            result.ok ? "bg-[#cdfee1] text-[#0c5132]" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
