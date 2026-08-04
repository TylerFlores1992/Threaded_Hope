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
  status: string;
  fulfillmentStatus: string;
  source: string;
  isGift: boolean;
  pickup: boolean;
  hasLabel: boolean;
  carrier: string | null;
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

const PER_PAGE = 50;

const selectClass =
  "rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-ink";

/** Shopify's badge vocabulary: a dot plus a short status word. */
function Badge({
  tone,
  children,
}: {
  tone: "success" | "attention" | "info" | "critical";
  children: React.ReactNode;
}) {
  const style = {
    success: "bg-[#cdfee1] text-[#0c5132]",
    attention: "bg-[#ffd6a4] text-[#5e4200]",
    info: "bg-[#e3e3e3] text-[#4a4a4a]",
    critical: "bg-[#ffd6d6] text-[#8e1f0b]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[12px] font-medium ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

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
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  /** Changing what you're looking at resets the page and the selection. */
  const reset = () => {
    setPage(0);
    setSelected([]);
  };

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
        VIEWS.map((v) => [
          v.id,
          orders.filter((o) => matchesView(o, v.id)).length,
        ]),
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

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const start = page * PER_PAGE;
  const rows = filtered.slice(start, start + PER_PAGE);

  const allOnPageSelected =
    rows.length > 0 && rows.every((o) => selected.includes(o.id));
  const toggleAll = () =>
    setSelected(allOnPageSelected ? [] : rows.map((o) => o.id));
  const toggleOne = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  return (
    <div>
      {/* Saved views */}
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              setView(v.id);
              reset();
            }}
            className={`px-3 py-2 text-[13px] ${
              view === v.id
                ? "border-b-2 border-ink font-semibold text-ink"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {v.label}
            <span className="ml-1 text-[12px] text-ink-soft">
              ({counts[v.id]})
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
          placeholder="Search by customer, email, item, or tracking"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-ink"
        />
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as Sort);
            reset();
          }}
          className={selectClass}
          aria-label="Sort orders"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total-desc">Total: High to Low</option>
          <option value="total-asc">Total: Low to High</option>
        </select>
      </div>

      {/* Bulk action bar, shown once anything is ticked. */}
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-[#1a1a1a] px-3 py-2 text-[13px] text-white">
          <span className="font-medium">{selected.length} selected</span>
          {/* Route handler returning a file download — a plain <a> is correct. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href={`/admin/orders/export?ids=${selected.join(",")}`}
            className="rounded px-2 py-1 hover:bg-white/10"
          >
            Export selected
          </a>
          <button
            onClick={() => setSelected([])}
            className="ml-auto rounded px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto admin-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all orders on this page"
                  className="h-4 w-4 accent-[#303030]"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Order</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Total</th>
              <th className="px-3 py-2.5 font-medium">Payment</th>
              <th className="px-3 py-2.5 font-medium">Fulfillment</th>
              <th className="px-3 py-2.5 font-medium">Items</th>
              <th className="px-3 py-2.5 font-medium">Delivery method</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr
                key={o.id}
                className={`group/row ${
                  selected.includes(o.id) ? "bg-[#f1f8ff]" : "hover:bg-black/[0.02]"
                }`}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggleOne(o.id)}
                    aria-label={`Select order ${o.id.slice(-8)}`}
                    className="h-4 w-4 accent-[#303030]"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    #{o.id.slice(-8).toUpperCase()}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                  {new Date(o.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-3 py-2.5">
                  {o.email ? (
                    <Link
                      href={`/admin/customers/${encodeURIComponent(o.email)}`}
                      className="text-[#005bd3] hover:underline"
                    >
                      {o.customerName ?? o.email}
                    </Link>
                  ) : (
                    <span className="text-ink">{o.customerName ?? "—"}</span>
                  )}
                  {o.source !== "web" && (
                    <span className="ml-1.5 text-[11px] capitalize text-ink-soft">
                      {o.source}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-ink">
                  {formatPrice(o.amountTotalCents / 100)}
                </td>
                <td className="px-3 py-2.5">
                  {o.status === "paid" ? (
                    <Badge tone="info">Paid</Badge>
                  ) : (
                    <Badge tone="attention">{o.status}</Badge>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <FulfillmentControl
                    orderId={o.id}
                    status={o.fulfillmentStatus}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                  {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-2.5 text-ink-soft">
                  {/* Carrier can be an empty string, not just null, so ?? isn't
                      enough — an unnamed carrier left a dangling separator. */}
                  {o.pickup
                    ? "Local pickup"
                    : o.trackingNumber
                      ? [o.carrier || "Shipping", o.trackingNumber].join(" · ")
                      : "Shipping"}
                  {o.isGift && (
                    <span className="ml-1.5 text-[11px] text-ink">Gift</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <Link
                    href={`/admin/orders/${o.id}/slip`}
                    className="rounded px-1.5 py-1 text-[#005bd3] hover:bg-black/5"
                  >
                    Slip
                  </Link>
                  <Link
                    href={`/admin/orders/${o.id}/label`}
                    className="rounded px-1.5 py-1 text-[#005bd3] hover:bg-black/5"
                  >
                    {o.hasLabel ? "Label" : "Buy label"}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-ink-soft">
                  No orders match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination, along the bottom like Shopify's */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[12px] text-ink-soft">
          <span>
            {filtered.length === 0
              ? "0"
              : `${start + 1}–${Math.min(start + PER_PAGE, filtered.length)}`}{" "}
            of {filtered.length}
          </span>
          <span className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              aria-label="Next page"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
            >
              ›
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
