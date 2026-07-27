"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/data/products";
import type { Collection } from "@/data/collections";
import { ProductCard } from "./ProductCard";

type Sort = "newest" | "price-asc" | "price-desc";

export function ShopClient({
  products,
  collections,
  initialQuery = "",
}: {
  products: Product[];
  collections: Collection[];
  initialQuery?: string;
}) {
  const [activeCollections, setActiveCollections] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("newest");
  const [query, setQuery] = useState(initialQuery);

  const toggleCollection = (slug: string) =>
    setActiveCollections((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      const matchCollection =
        activeCollections.length === 0 ||
        p.collections.some((c) => activeCollections.includes(c));
      const matchQuery =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.collectionName.toLowerCase().includes(q);
      return matchCollection && matchQuery;
    });

    list = [...list].sort((a, b) => {
      // Sold-out items always sink below in-stock ones, whatever the sort.
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return b.createdAt.localeCompare(a.createdAt); // newest
    });
    return list;
  }, [products, activeCollections, sort, query]);

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Filters */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-border">
          <label htmlFor="shop-search" className="text-sm font-semibold text-ink">
            Search
          </label>
          <input
            id="shop-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            className="mt-2 w-full rounded-full border border-border bg-white px-4 py-2 text-sm outline-none focus:border-sage-deep"
          />

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink">Collections</legend>
            <div className="mt-2 space-y-1">
              {collections.map((c) => (
                <label
                  key={c.slug}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-ink hover:bg-sand"
                >
                  <input
                    type="checkbox"
                    checked={activeCollections.includes(c.slug)}
                    onChange={() => toggleCollection(c.slug)}
                    className="h-4 w-4 accent-sage-deep"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>

          {(activeCollections.length > 0 || query) && (
            <button
              type="button"
              onClick={() => {
                setActiveCollections([]);
                setQuery("");
              }}
              className="mt-4 text-sm font-medium text-sage-deep hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </aside>

      {/* Results */}
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft" aria-live="polite">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-sage-deep"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-white/70 p-10 text-center text-ink-soft ring-1 ring-border">
            No products match your filters. Try clearing them.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
