"use client";

import { useState, useTransition } from "react";
import { refundOrder } from "@/app/admin/(panel)/orders/actions";
import { formatPrice } from "@/lib/format";

/**
 * Refund controls on the order page. Real money moves, so it stays collapsed
 * behind a button, defaults to the full remaining amount, and confirms the
 * exact figure before sending.
 */
export function RefundPanel({
  orderId,
  totalCents,
  refundedCents,
  stripeBacked,
  alreadyRestocked,
}: {
  orderId: string;
  totalCents: number;
  refundedCents: number;
  stripeBacked: boolean;
  alreadyRestocked: boolean;
}) {
  const remaining = totalCents - refundedCents;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [restock, setRestock] = useState(!alreadyRestocked);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  if (remaining <= 0 && !result) {
    return (
      <p className="mt-4 rounded-lg bg-[#cdfee1] px-3 py-2 text-[13px] text-[#0c5132]">
        Fully refunded — {formatPrice(refundedCents / 100)} returned.
      </p>
    );
  }

  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setResult({ ok: false, message: "Enter an amount greater than zero." });
      return;
    }
    if (cents > remaining) {
      setResult({
        ok: false,
        message: `Only ${formatPrice(remaining / 100)} is left to refund.`,
      });
      return;
    }
    const what = stripeBacked
      ? `Refund ${formatPrice(cents / 100)} to the customer's card?`
      : `Record a ${formatPrice(cents / 100)} refund? This order wasn't paid through Stripe, so no money will move.`;
    if (!window.confirm(what)) return;
    start(async () => {
      const r = await refundOrder(orderId, cents, { restock, reason });
      setResult(r);
      if (r.ok) setOpen(false);
    });
  };

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
        >
          {refundedCents > 0 ? "Refund more" : "Refund or return"}
        </button>
      ) : (
        <div className="admin-card max-w-lg p-4">
          <h2 className="text-[13px] font-semibold text-ink">
            {stripeBacked ? "Refund to card" : "Record a refund"}
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            {stripeBacked
              ? "Stripe returns the money to the card the customer paid with and emails them a receipt."
              : "This order wasn't paid through Stripe, so nothing is charged back — this only records what you refunded."}{" "}
            Up to {formatPrice(remaining / 100)} is left to refund.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center rounded-lg border border-border bg-white px-2 py-1.5 text-[13px]">
              <span className="text-ink-soft">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="Refund amount"
                className="w-28 bg-transparent px-1 outline-none"
              />
            </span>
            <button
              type="button"
              onClick={() => setAmount((remaining / 100).toFixed(2))}
              className="text-[12px] text-ink-soft underline hover:text-ink"
            >
              Full amount
            </button>
          </div>

          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, for your records)"
            aria-label="Refund reason"
            className="mt-3 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-[13px] outline-none focus:border-sage-deep"
          />

          {alreadyRestocked ? (
            <p className="mt-3 text-[13px] text-ink-soft">
              These items were already put back in stock by the earlier refund.
            </p>
          ) : (
          <label className="mt-3 flex items-start gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Put the items back in stock
              <span className="block text-[12px]">
                Leave this off if the piece isn&apos;t coming back or can&apos;t
                be resold.
              </span>
            </span>
          </label>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-50"
            >
              {pending
                ? "Refunding…"
                : stripeBacked
                  ? "Refund"
                  : "Record refund"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-sand"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p
          className={`mt-3 max-w-lg rounded-lg p-3 text-[13px] ${
            result.ok ? "bg-[#cdfee1] text-[#0c5132]" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
