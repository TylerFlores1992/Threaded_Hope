"use client";

import { useTransition } from "react";
import { markInvoicePaid } from "@/app/admin/(panel)/orders/actions";

/**
 * The banner on an order that's been invoiced but not paid.
 *
 * The "paid another way" button is the counterpart to the Venmo/Zelle/cash
 * options in the invoice email — those never reach Stripe, so someone has to
 * say so here.
 */
export function AwaitingPayment({
  orderId,
  email,
  payUrl,
}: {
  orderId: string;
  email: string | null;
  payUrl: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 rounded-lg border border-[#ffd6a4] bg-[#fff6e8] px-3 py-2.5 text-sm">
      <p className="font-medium text-[#5e4200]">Awaiting payment</p>
      <p className="mt-0.5 text-xs text-[#5e4200]">
        An invoice was emailed to {email ?? "the customer"} with card, Venmo,
        Zelle and cash options. It won&apos;t count toward your sales until
        it&apos;s paid.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a
          href={payUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-sage-deep underline"
        >
          Open the card payment page ↗
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Mark this order paid? Use this when they paid by Venmo, Zelle or cash — the card link will be cancelled so they can't pay twice.",
              )
            ) {
              return;
            }
            start(() => markInvoicePaid(orderId));
          }}
          className="rounded-lg border border-[#e0c9a0] bg-white px-2.5 py-1 text-xs font-medium text-[#5e4200] hover:bg-[#fffaf2] disabled:opacity-60"
        >
          {pending ? "Saving…" : "They paid another way"}
        </button>
      </div>
    </div>
  );
}
