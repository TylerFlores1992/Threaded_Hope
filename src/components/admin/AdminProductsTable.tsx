"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { placeholderImage } from "@/lib/placeholder";
import { DeleteProductButton } from "./DeleteProductButton";

export type AdminProduct = {
  id: string;
  name: string;
  image?: string;
  collectionSlug: string;
  collections: string[];
  priceCents: number;
  stock: number | null;
  inStock: boolean;
  featured: boolean;
  createdAt: number;
};

type Status = "all" | "in" | "out" | "low" | "featured";
type Sort =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "stock-asc";

const LOW_STOCK = 3;

const selectClass =
  "rounded-full border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sage-deep";

export function AdminProductsTable({
  products,
  collections,
}: {
  products: AdminProduct[];
  collections: { slug: string; name: string }[];
}) {
  // Persist filters across navigation (e.g. edit a product, come back) via
  // sessionStorage so the list stays where you left it.
  const STORE_KEY = "admin-products-filters";
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
  const [collection, setCollection] = useState<string>(saved.collection ?? "all");
  const [status, setStatus] = useState<Status>(saved.status ?? "all");
  const [sort, setSort] = useState<Sort>(saved.sort ?? "newest");

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ query, collection, status, sort }),
      );
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }, [query, collection, status, sort]);

  const nameOf = useMemo(() => {
    const m = new Map(collections.map((c) => [c.slug, c.name]));
    return (slug: string) => m.get(slug) ?? slug;
  }, [collections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      const matchQuery =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.collections.some((c) => nameOf(c).toLowerCase().includes(q));
      const matchCollection =
        collection === "all" || p.collections.includes(collection);
      const isLow = p.stock != null && p.stock <= LOW_STOCK;
      const matchStatus =
        status === "all" ||
        (status === "in" && p.inStock) ||
        (status === "out" && !p.inStock) ||
        (status === "low" && isLow) ||
        (status === "featured" && p.featured);
      return matchQuery && matchCollection && matchStatus;
    });

    const sortStock = (v: number | null) => (v == null ? Infinity : v);
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.priceCents - b.priceCents;
        case "price-desc":
          return b.priceCents - a.priceCents;
        case "stock-asc":
          return sortStock(a.stock) - sortStock(b.stock);
        default:
          return b.createdAt - a.createdAt; // newest
      }
    });
  }, [products, query, collection, status, sort, nameOf]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="min-w-[200px] flex-1 rounded-full border border-border bg-white px-4 py-1.5 text-sm outline-none focus:border-sage-deep"
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
          <option value="low">Low stock</option>
          <option value="featured">Featured</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={selectClass}
          aria-label="Sort products"
        >
          <option value="newest">Newest</option>
          <option value="name-asc">Name: A–Z</option>
          <option value="name-desc">Name: Z–A</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="stock-asc">Stock: Low to High</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
        {filtered.length} of {products.length} product
        {products.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Collections</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => (
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
                <td className="px-4 py-3">{formatPrice(p.priceCents / 100)}</td>
                <td className="px-4 py-3 text-ink-soft">{p.stock ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {!p.inStock && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Sold out
                      </span>
                    )}
                    {p.featured && (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-sage-deep">
                        Featured
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="text-sage-deep hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-soft">
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
