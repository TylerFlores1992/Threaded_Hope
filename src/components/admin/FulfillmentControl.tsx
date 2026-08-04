"use client";

import { useTransition } from "react";
import { setFulfillment } from "@/app/admin/(panel)/orders/actions";

type Status = "unfulfilled" | "shipped" | "delivered";

/** Shopify's fulfillment tones: attention while it's on you, success once done. */
const badge: Record<Status, string> = {
  unfulfilled: "bg-[#ffd6a4] text-[#5e4200]",
  shipped: "bg-[#e3e3e3] text-[#4a4a4a]",
  delivered: "bg-[#cdfee1] text-[#0c5132]",
};
const label: Record<Status, string> = {
  unfulfilled: "Unfulfilled",
  shipped: "Shipped",
  delivered: "Delivered",
};

/**
 * Order fulfillment badge + inline actions. Marking "shipped" emails the
 * customer their tracking (server-side). Advancing/reverting is one click.
 */
export function FulfillmentControl({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const s = (["unfulfilled", "shipped", "delivered"].includes(status)
    ? status
    : "unfulfilled") as Status;

  const go = (next: Status) =>
    start(() => {
      void setFulfillment(orderId, next);
    });

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-[12px] font-medium ${badge[s]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {label[s]}
      </span>
      {!pending && (
        <span className="flex gap-1 opacity-0 transition group-hover/row:opacity-100 focus-within:opacity-100">
          {s === "unfulfilled" && (
            <button
              onClick={() => go("shipped")}
              className="whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] text-[#005bd3] hover:bg-black/5"
            >
              Mark shipped
            </button>
          )}
          {s === "shipped" && (
            <button
              onClick={() => go("delivered")}
              className="whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] text-[#005bd3] hover:bg-black/5"
            >
              Mark delivered
            </button>
          )}
          {s !== "unfulfilled" && (
            <button
              onClick={() => go("unfulfilled")}
              aria-label="Reset status"
              className="rounded px-1.5 py-0.5 text-[12px] text-ink-soft hover:bg-black/5"
            >
              ↺
            </button>
          )}
        </span>
      )}
      {pending && <span className="text-xs text-ink-soft">…</span>}
    </div>
  );
}
