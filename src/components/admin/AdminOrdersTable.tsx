"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { FulfillmentControl } from "./FulfillmentControl";

export type AdminOrder = {
  id: string;
  createdAt: string;
  customerName: string | null;
  email: string | null;
  itemCount: number;
  itemNames: string;
  amountTotalCents: number;
  fulfillmentStatus: string;
  source: string;
  isGift: boolean;
  pickup: boolean;
  hasLabel: boolean;
  trackingNumber: string | null;
};

/** Saved views, mirroring Shopify's tabs above the order list. */
type View = "all" | "unfulfilled" | "shipped" | "delivered" | "pickup" | "gift";
type Sort = "newest" | "oldest" | "total-desc" | "total-asc";

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unfulfilled", label: "Unfulfilled" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "pickup", label: "Local pickup" },
  { id: "gift", label: "Gifts" },
];

const selectClass =
  "rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sage-deep";

const matchesView = (o: AdminOrder, view: View) => {
  switch (view) {
    case "unfulfilled":
      return o.fulfillmentStatus === "unfulfilled";
    case "shipped":
      return o.fulfillmentStatus === "shipped";
    case "delivered":
      return o.fulfillmentStatus === "delivered";
    case "pickup":
      return o.pickup;
    case "gift":
      return o.isGift;
    default:
      return true;
  }
};

export function AdminOrdersTable({ orders }: { orders: AdminOrder[] }) {
  const STORE_KEY = "admin-orders-filters";
  const saved =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "{}");
          } catch {
            return {};
          }
        })()
      : {};
  const [query, setQuery] = useState<string>(saved.query ?? "");
  const [view, setView] = useState<View>(saved.view ?? "all");
  const [sort, setSort] = useState<Sort>(saved.sort ?? "newest");

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ query, view, sort }));
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }, [query, view, sort]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        VIEWS.map((v) => [v.id, orders.filter((o) => matchesView(o, v.id)).length]),
      ) as Record<View, number>,
    [orders],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = orders.filter((o) => {
      const matchQuery =
        q === "" ||
        (o.customerName ?? "").toLowerCase().includes(q) ||
        (o.email ?? "").toLowerCase().includes(q) ||
        o.itemNames.toLowerCase().includes(q) ||
        (o.trackingNumber ?? "").toLowerCase().includes(q) ||
        o.id.slice(-8).toLowerCase().includes(q);
      return matchQuery && matchesView(o, view);
    });

    return [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "total-desc":
          return b.amountTotalCents - a.amountTotalCents;
        case "total-asc":
          return a.amountTotalCents - b.amountTotalCents;
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });
  }, [orders, query, view, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-2 text-sm ${
              view === v.id
                ? "border-b-2 border-sage-deep font-medium text-ink"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {v.label}
            <span className="ml-1 text-xs text-ink-soft">({counts[v.id]})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer, email, item, or tracking…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-white px-4 py-1.5 text-sm outline-none focus:border-sage-deep"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={selectClass}
          aria-label="Sort orders"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total-desc">Total: High to Low</option>
          <option value="total-asc">Total: Low to High</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
        {filtered.length} of {orders.length} order
        {orders.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-x-auto admin-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Delivery</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Fulfillment</th>
              <th className="px-4 py-3 font-medium text-right">Slip</th>
              <th className="px-4 py-3 font-medium text-right">Label</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-mono text-xs font-medium text-sage-deep hover:underline"
                  >
                    #{o.id.slice(-8).toUpperCase()}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {new Date(o.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-ink">
                  {o.email ? (
                    <Link
                      href={`/admin/customers/${encodeURIComponent(o.email)}`}
                      className="font-medium text-sage-deep hover:underline"
                    >
                      {o.customerName ?? o.email}
                    </Link>
                  ) : (
                    (o.customerName ?? "—")
                  )}
                  {o.source === "manual" && (
                    <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                      Manual
                    </span>
                  )}
                  {o.customerName && o.email && (
                    <span className="block text-xs text-ink-soft">{o.email}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  <span className="block max-w-xs truncate text-xs">
                    {o.itemNames}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {o.pickup && (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft">
                        Pickup
                      </span>
                    )}
                    {o.isGift && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-ink">
                        Gift
                      </span>
                    )}
                    {!o.pickup && !o.isGift && (
                      <span className="text-xs text-ink-soft">Shipping</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-sage-deep">
                  {formatPrice(o.amountTotalCents / 100)}
                </td>
                <td className="px-4 py-3">
                  <FulfillmentControl
                    orderId={o.id}
                    status={o.fulfillmentStatus}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/orders/${o.id}/slip`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-sage-deep hover:bg-sand"
                  >
                    Print
                  </Link>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/orders/${o.id}/label`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-sage-deep hover:bg-sand"
                  >
                    {o.hasLabel ? "View" : "Buy"}
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink-soft">
                  No orders match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
