"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";

export type AdminCustomer = {
  email: string;
  name: string | null;
  location: string | null;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  subscribed: boolean;
};

/** Saved views, mirroring Shopify's segment tabs. */
type View = "all" | "repeat" | "subscribed" | "new";
type Sort = "recent" | "spent-desc" | "orders-desc" | "name-asc";

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All" },
  { id: "repeat", label: "Repeat customers" },
  { id: "subscribed", label: "Subscribed" },
  { id: "new", label: "Never ordered" },
];

const selectClass =
  "rounded-full border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sage-deep";

export function AdminCustomersTable({
  customers,
}: {
  customers: AdminCustomer[];
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = customers.filter((c) => {
      const matchQuery =
        q === "" ||
        c.email.includes(q) ||
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q);
      const matchView =
        view === "all" ||
        (view === "repeat" && c.orderCount > 1) ||
        (view === "subscribed" && c.subscribed) ||
        (view === "new" && c.orderCount === 0);
      return matchQuery && matchView;
    });

    return [...list].sort((a, b) => {
      switch (sort) {
        case "spent-desc":
          return b.totalSpentCents - a.totalSpentCents;
        case "orders-desc":
          return b.orderCount - a.orderCount;
        case "name-asc":
          return (a.name ?? a.email).localeCompare(b.name ?? b.email);
        default:
          return (
            new Date(b.lastOrderAt ?? 0).getTime() -
            new Date(a.lastOrderAt ?? 0).getTime()
          );
      }
    });
  }, [customers, query, view, sort]);

  return (
    <div>
      {/* Saved views */}
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
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers…"
          className="min-w-[200px] flex-1 rounded-full border border-border bg-white px-4 py-1.5 text-sm outline-none focus:border-sage-deep"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={selectClass}
          aria-label="Sort customers"
        >
          <option value="recent">Most recent order</option>
          <option value="spent-desc">Amount spent</option>
          <option value="orders-desc">Number of orders</option>
          <option value="name-asc">Name: A–Z</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
        {filtered.length} of {customers.length} customer
        {customers.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Email subscription</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium text-right">Orders</th>
              <th className="px-4 py-3 font-medium text-right">Amount spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => (
              <tr key={c.email}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/customers/${encodeURIComponent(c.email)}`}
                    className="font-medium text-sage-deep hover:underline"
                  >
                    {c.name ?? c.email}
                  </Link>
                  {c.name && (
                    <span className="block text-xs text-ink-soft">{c.email}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.subscribed ? (
                    <span className="rounded-full bg-sage-deep/10 px-2 py-0.5 text-xs font-medium text-sage-deep">
                      Subscribed
                    </span>
                  ) : (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft">
                      Not subscribed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-soft">{c.location ?? "—"}</td>
                <td className="px-4 py-3 text-right text-ink-soft">
                  {c.orderCount}
                </td>
                <td className="px-4 py-3 text-right font-medium text-sage-deep">
                  {formatPrice(c.totalSpentCents / 100)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-soft">
                  No customers match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
