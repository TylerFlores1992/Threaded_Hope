"use client";

import { useTransition } from "react";
import { setFulfillment } from "@/app/admin/(panel)/orders/actions";

type Status = "unfulfilled" | "shipped" | "delivered";

const badge: Record<Status, string> = {
  unfulfilled: "bg-sand text-ink-soft",
  shipped: "bg-sage-deep/15 text-sage-deep",
  delivered: "bg-sage-deep text-white",
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
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[s]}`}
      >
        {label[s]}
      </span>
      {!pending && (
        <span className="flex gap-1">
          {s === "unfulfilled" && (
            <button
              onClick={() => go("shipped")}
              className="rounded px-1.5 py-0.5 text-xs text-sage-deep hover:bg-sand"
            >
              Mark shipped
            </button>
          )}
          {s === "shipped" && (
            <button
              onClick={() => go("delivered")}
              className="rounded px-1.5 py-0.5 text-xs text-sage-deep hover:bg-sand"
            >
              Mark delivered
            </button>
          )}
          {s !== "unfulfilled" && (
            <button
              onClick={() => go("unfulfilled")}
              aria-label="Reset status"
              className="rounded px-1.5 py-0.5 text-xs text-ink-soft hover:bg-sand"
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
