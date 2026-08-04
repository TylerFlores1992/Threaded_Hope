"use client";

import { useMemo, useState } from "react";
import { placeholderImage } from "@/lib/placeholder";
import { StockField } from "./StockField";
import { SizeStockField } from "./SizeStockField";
import { OptionStockField } from "./OptionStockField";

export type AdminInventoryItem = {
  id: string;
  name: string;
  image?: string;
  collections: string[];
  stock: number | null;
  inStock: boolean;
  /** Per-size rows when the product has a size axis; null otherwise. */
  sizes: { label: string; count: number | null }[] | null;
  /** Per-option rows for each non-size group (colour, style, …). */
  optionGroups: {
    name: string;
    options: { label: string; count: number | null }[];
  }[];
};

type Status = "all" | "in" | "out" | "tracked" | "untracked";
type Sort = "name-asc" | "name-desc" | "stock-asc" | "stock-desc";

const LOW_STOCK = 3;

const selectClass =
  "rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sage-deep";

export function AdminInventoryTable({
  items,
  collections,
}: {
  items: AdminInventoryItem[];
  collections: { slug: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("all");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("stock-asc");

  const nameOf = useMemo(() => {
    const m = new Map(collections.map((c) => [c.slug, c.name]));
    return (slug: string) => m.get(slug) ?? slug;
  }, [collections]);

  const tracked = items.filter((p) => p.stock != null).length;
  const lowOrOut = items.filter(
    (p) => (p.stock != null && p.stock <= LOW_STOCK) || !p.inStock,
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((p) => {
      const matchQuery =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.collections.some((c) => nameOf(c).toLowerCase().includes(q));
      const matchCollection =
        collection === "all" || p.collections.includes(collection);
      const matchStatus =
        status === "all" ||
        (status === "in" && p.inStock) ||
        (status === "out" && !p.inStock) ||
        (status === "tracked" && p.stock != null) ||
        (status === "untracked" && p.stock == null);
      return matchQuery && matchCollection && matchStatus;
    });

    const s = (v: number | null) => (v == null ? Infinity : v);
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "stock-desc":
          return s(b.stock) - s(a.stock);
        default:
          return s(a.stock) - s(b.stock); // stock-asc
      }
    });
  }, [items, query, collection, status, sort, nameOf]);

  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-sand px-3 py-1 text-ink-soft">
          {tracked} tracked
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
          {lowOrOut} low / out
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-white px-4 py-1.5 text-sm outline-none focus:border-sage-deep"
        />
        <select
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          className={selectClass}
          aria-label="Filter by collection"
        >
          <option value="all">All collections</option>
          {collections.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          <option value="in">In stock</option>
          <option value="out">Sold out</option>
          <option value="tracked">Tracked</option>
          <option value="untracked">Untracked</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={selectClass}
          aria-label="Sort inventory"
        >
          <option value="stock-asc">Stock: Low to High</option>
          <option value="stock-desc">Stock: High to Low</option>
          <option value="name-asc">Name: A–Z</option>
          <option value="name-desc">Name: Z–A</option>
        </select>
      </div>

      <p className="mt-3 text-sm text-ink-soft" aria-live="polite">
        {filtered.length} of {items.length} product{items.length === 1 ? "" : "s"}
      </p>

      <div className="mt-3 overflow-x-auto admin-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Collections</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => {
              const isLow = p.stock != null && p.stock <= LOW_STOCK;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image || placeholderImage(p.name, 145)}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
                      loading="lazy"
                    />
                  </td>
                  <td className="px-4 py-3 text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {p.collections.map(nameOf).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1.5">
                      {p.sizes ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {p.sizes.map((s) => (
                            <SizeStockField
                              key={s.label}
                              id={p.id}
                              size={s.label}
                              initial={s.count}
                            />
                          ))}
                        </div>
                      ) : (
                        p.optionGroups.length === 0 && (
                          <StockField id={p.id} initial={p.stock} />
                        )
                      )}
                      {p.optionGroups.map((g) => (
                        <div key={g.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-xs font-medium text-ink">
                            {g.name}
                          </span>
                          {g.options.map((o) => (
                            <OptionStockField
                              key={o.label}
                              id={p.id}
                              group={g.name}
                              option={o.label}
                              initial={o.count}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!p.inStock ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Sold out
                      </span>
                    ) : p.sizes ? (
                      <span className="text-xs text-ink-soft">In stock</span>
                    ) : isLow ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        Low
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">In stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-soft">
                  No products match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
