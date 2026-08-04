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
  status: string;
  productType: string | null;
  vendor: string | null;
  /** Revenue rank over 90 days: A earns most, C least. */
  abc: "A" | "B" | "C";
  unitsSold30: number;
  createdAt: number;
};

/** Saved views, mirroring Shopify's tabs above the product list. */
type View = "all" | "active" | "draft" | "archived" | "out";
type Status = "all" | "in" | "out" | "featured";
type Sort =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "stock-asc"
  | "stock-desc"
  | "sold-desc";

/** Optional columns — hidden ones keep the table readable on small screens. */
const COLUMNS = [
  { id: "status", label: "Status" },
  { id: "collections", label: "Collections" },
  { id: "price", label: "Price" },
  { id: "stock", label: "Inventory" },
  { id: "sold", label: "Sold (30d)" },
  { id: "abc", label: "ABC" },
  { id: "type", label: "Product type" },
  { id: "vendor", label: "Vendor" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

const DEFAULT_COLUMNS: ColumnId[] = [
  "status",
  "collections",
  "price",
  "stock",
  "type",
  "vendor",
];

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
  { id: "out", label: "Sold out" },
];

const selectClass =
  "rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sage-deep";

/** Shopify's status badge colours: success green, attention amber, neutral. */
const STATUS_STYLE: Record<string, string> = {
  active: "bg-[#cdfee1] text-[#0c5132]",
  draft: "bg-[#ffd6a4] text-[#5e4200]",
  archived: "bg-[#e3e3e3] text-[#4a4a4a]",
};

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
  const [view, setView] = useState<View>(saved.view ?? "all");
  const [sort, setSort] = useState<Sort>(saved.sort ?? "newest");
  const [columns, setColumns] = useState<ColumnId[]>(
    Array.isArray(saved.columns) && saved.columns.length > 0
      ? saved.columns
      : DEFAULT_COLUMNS,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ query, collection, status, view, sort, columns }),
      );
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }, [query, collection, status, view, sort, columns]);

  const shows = (id: ColumnId) => columns.includes(id);
  const toggleColumn = (id: ColumnId) =>
    setColumns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const nameOf = useMemo(() => {
    const m = new Map(collections.map((c) => [c.slug, c.name]));
    return (slug: string) => m.get(slug) ?? slug;
  }, [collections]);

  const counts = useMemo(
    () => ({
      all: products.length,
      active: products.filter((p) => p.status === "active").length,
      draft: products.filter((p) => p.status === "draft").length,
      archived: products.filter((p) => p.status === "archived").length,
      out: products.filter((p) => !p.inStock).length,
    }),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      const matchQuery =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        (p.vendor ?? "").toLowerCase().includes(q) ||
        (p.productType ?? "").toLowerCase().includes(q) ||
        p.collections.some((c) => nameOf(c).toLowerCase().includes(q));
      const matchCollection =
        collection === "all" || p.collections.includes(collection);
      const matchStatus =
        status === "all" ||
        (status === "in" && p.inStock) ||
        (status === "out" && !p.inStock) ||
        (status === "featured" && p.featured);
      const matchView =
        view === "all" ||
        (view === "out" ? !p.inStock : p.status === view);
      return matchQuery && matchCollection && matchStatus && matchView;
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
        case "stock-desc":
          return sortStock(b.stock) - sortStock(a.stock);
        case "sold-desc":
          return b.unitsSold30 - a.unitsSold30;
        default:
          return b.createdAt - a.createdAt; // newest
      }
    });
  }, [products, query, collection, status, view, sort, nameOf]);

  const colCount = 2 + columns.length + 1; // photo + name + optional + actions

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
            <span className="ml-1 text-xs text-ink-soft">({counts[v.id]})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
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
          aria-label="Filter by availability"
        >
          <option value="all">Any availability</option>
          <option value="in">In stock</option>
          <option value="out">Sold out</option>
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
          <option value="stock-desc">Stock: High to Low</option>
          <option value="sold-desc">Best selling (30 days)</option>
        </select>

        {/* Column picker */}
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-sand"
          >
            Columns ▾
          </button>
          {pickerOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-white p-2 shadow-lg">
              {COLUMNS.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-ink hover:bg-sand"
                >
                  <input
                    type="checkbox"
                    checked={shows(c.id)}
                    onChange={() => toggleColumn(c.id)}
                    className="h-4 w-4 accent-sage-deep"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-ink-soft" aria-live="polite">
        {filtered.length} of {products.length} product
        {products.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-x-auto admin-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Name</th>
              {shows("status") && <th className="px-4 py-3 font-medium">Status</th>}
              {shows("collections") && (
                <th className="px-4 py-3 font-medium">Collections</th>
              )}
              {shows("price") && <th className="px-4 py-3 font-medium">Price</th>}
              {shows("stock") && (
                <th className="px-4 py-3 font-medium">Inventory</th>
              )}
              {shows("sold") && (
                <th className="px-4 py-3 font-medium text-right">Sold (30d)</th>
              )}
              {shows("abc") && <th className="px-4 py-3 font-medium">ABC</th>}
              {shows("type") && (
                <th className="px-4 py-3 font-medium">Product type</th>
              )}
              {shows("vendor") && <th className="px-4 py-3 font-medium">Vendor</th>}
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => (
              <tr key={p.id} className={p.status !== "active" ? "opacity-70" : ""}>
                <td className="px-4 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image || placeholderImage(p.name, 145)}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
                    loading="lazy"
                  />
                </td>
                <td className="px-4 py-3 text-ink">
                  {p.name}
                  {p.featured && (
                    <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[10px] text-sage-deep">
                      Featured
                    </span>
                  )}
                </td>
                {shows("status") && (
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLE[p.status] ?? STATUS_STYLE.archived
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                )}
                {shows("collections") && (
                  <td className="px-4 py-3 text-ink-soft">
                    {p.collections.map(nameOf).join(", ")}
                  </td>
                )}
                {shows("price") && (
                  <td className="px-4 py-3">{formatPrice(p.priceCents / 100)}</td>
                )}
                {shows("stock") && (
                  <td className="px-4 py-3">
                    {!p.inStock ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Sold out
                      </span>
                    ) : (
                      <span className="text-ink-soft">
                        {p.stock == null ? "Untracked" : `${p.stock} in stock`}
                      </span>
                    )}
                  </td>
                )}
                {shows("sold") && (
                  <td className="px-4 py-3 text-right text-ink-soft">
                    {p.unitsSold30}
                  </td>
                )}
                {shows("abc") && (
                  <td className="px-4 py-3 text-ink-soft">{p.abc}</td>
                )}
                {shows("type") && (
                  <td className="px-4 py-3 text-ink-soft">{p.productType ?? "—"}</td>
                )}
                {shows("vendor") && (
                  <td className="px-4 py-3 text-ink-soft">{p.vendor ?? "—"}</td>
                )}
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
                <td
                  colSpan={colCount}
                  className="px-4 py-10 text-center text-ink-soft"
                >
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
