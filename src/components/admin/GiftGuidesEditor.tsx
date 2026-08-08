"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { saveGiftingConfig } from "@/app/admin/(panel)/collections/actions";
import type { GiftGuide, GuideSource } from "@/lib/gifting";
import { formatPrice } from "@/lib/format";

export type GuideCollection = { slug: string; name: string };
export type GuideProduct = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  collections: string[];
};

const field =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-ink outline-none focus:ring-2 focus:ring-sage-deep";

const SOURCE_LABELS: { id: GuideSource; label: string; help: string }[] = [
  {
    id: "collection",
    label: "Everything in a collection",
    help: "Stays up to date on its own as you add products to that collection.",
  },
  {
    id: "price",
    label: "Everything under a price",
    help: "Good for a “stocking stuffers” row — it follows your prices.",
  },
  {
    id: "products",
    label: "Products I choose",
    help: "Exactly these, in the order you add them.",
  },
];

/** A row of products for one guide, with a search box to add more. */
function ProductPicker({
  products,
  chosen,
  onChange,
}: {
  products: GuideProduct[];
  chosen: string[];
  onChange: (slugs: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const bySlug = useMemo(
    () => new Map(products.map((p) => [p.slug, p])),
    [products],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => !chosen.includes(p.slug) && p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, products, chosen]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= chosen.length) return;
    const next = [...chosen];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {chosen.length > 0 && (
        <ul className="mb-2 space-y-1">
          {chosen.map((slug, i) => {
            const p = bySlug.get(slug);
            return (
              <li
                key={slug}
                className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-2 py-1.5 text-[13px]"
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded ring-1 ring-border">
                  {p?.image && (
                    <Image src={p.image} alt="" fill sizes="32px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {p ? p.name : `${slug} (no longer in the shop)`}
                </span>
                {p && (
                  <span className="shrink-0 text-ink-soft">
                    {formatPrice(p.price)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="rounded px-1 text-ink-soft hover:bg-black/5 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === chosen.length - 1}
                  aria-label="Move down"
                  className="rounded px-1 text-ink-soft hover:bg-black/5 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onChange(chosen.filter((s) => s !== slug))}
                  aria-label={`Remove ${p?.name ?? slug}`}
                  className="rounded px-1 text-red-700 hover:bg-black/5"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products to add…"
        aria-label="Search products to add"
        className={field}
      />
      {matches.length > 0 && (
        <ul className="mt-1 divide-y divide-border rounded-lg border border-border bg-white">
          {matches.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => {
                  onChange([...chosen, p.slug]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-sand"
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded ring-1 ring-border">
                  {p.image && (
                    <Image src={p.image} alt="" fill sizes="32px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                <span className="shrink-0 text-ink-soft">
                  {formatPrice(p.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="mt-1 text-[12px] text-ink-soft">
          Nothing matches — or it&apos;s already in this guide.
        </p>
      )}
    </div>
  );
}

/**
 * The rows of products on the Gifting page: add, remove, reorder, and choose
 * what goes in each one.
 */
export function GiftGuidesEditor({
  collections,
  products,
  guides: initial,
}: {
  collections: GuideCollection[];
  products: GuideProduct[];
  guides: GiftGuide[];
}) {
  const [guides, setGuides] = useState<GiftGuide[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const edit = (i: number, patch: Partial<GiftGuide>) => {
    setGuides((prev) =>
      prev.map((g, n) => (n === i ? { ...g, ...patch } : g)),
    );
    setDirty(true);
    setSaved(false);
  };

  const moveGuide = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= guides.length) return;
    const next = [...guides];
    [next[i], next[j]] = [next[j], next[i]];
    setGuides(next);
    setDirty(true);
    setSaved(false);
  };

  const addGuide = () => {
    setGuides((prev) => [
      ...prev,
      {
        // Derived from the list rather than Date.now() — a render must stay pure.
        key: `guide-${prev.length + 1}-${prev.reduce((n, g) => n + g.key.length, 0)}`,
        heading: "New guide",
        blurb: "",
        source: "collection",
        collection: collections[0]?.slug,
        limit: 6,
      },
    ]);
    setDirty(true);
    setSaved(false);
  };

  const removeGuide = (i: number) => {
    setGuides((prev) => prev.filter((_, n) => n !== i));
    setDirty(true);
    setSaved(false);
  };

  const save = () =>
    start(async () => {
      await saveGiftingConfig(guides);
      setDirty(false);
      setSaved(true);
    });

  /** How many products a guide will actually show, so it can be checked here. */
  const countFor = (g: GiftGuide) => {
    if (g.source === "products") return (g.slugs ?? []).length;
    if (g.source === "price")
      return products.filter((p) => p.price <= (g.maxPrice ?? Infinity)).length;
    return products.filter((p) => g.collection && p.collections.includes(g.collection))
      .length;
  };

  return (
    <div className="max-w-3xl">
      <div className="space-y-4">
        {guides.map((g, i) => {
          const count = countFor(g);
          const shown = Math.min(count, g.limit);
          return (
            <section key={g.key} className="admin-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label className="block text-[12px] text-ink-soft">
                    Heading
                    <input
                      value={g.heading}
                      onChange={(e) => edit(i, { heading: e.target.value })}
                      className={field}
                    />
                  </label>
                </div>
                <div className="flex shrink-0 gap-1 pt-5">
                  <button
                    type="button"
                    onClick={() => moveGuide(i, -1)}
                    disabled={i === 0}
                    aria-label="Move guide up"
                    className="rounded border border-border px-2 py-1 text-[13px] text-ink-soft hover:bg-sand disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGuide(i, 1)}
                    disabled={i === guides.length - 1}
                    aria-label="Move guide down"
                    className="rounded border border-border px-2 py-1 text-[13px] text-ink-soft hover:bg-sand disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGuide(i)}
                    className="rounded border border-border px-2 py-1 text-[13px] text-red-700 hover:bg-sand"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <label className="mt-3 block text-[12px] text-ink-soft">
                Blurb <span className="text-ink-soft/70">(optional)</span>
                <textarea
                  value={g.blurb}
                  onChange={(e) => edit(i, { blurb: e.target.value })}
                  rows={2}
                  className={field}
                />
              </label>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block text-[12px] text-ink-soft">
                  Products
                  <select
                    value={g.source}
                    onChange={(e) =>
                      edit(i, { source: e.target.value as GuideSource })
                    }
                    className={field}
                  >
                    {SOURCE_LABELS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[12px] text-ink-soft">
                  Show up to
                  <span className="block text-[11px] text-ink-soft/80">
                    6 fills a row
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={g.limit}
                    onChange={(e) =>
                      edit(i, { limit: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className={`${field} w-24`}
                  />
                </label>
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                {SOURCE_LABELS.find((s) => s.id === g.source)?.help}
              </p>

              <div className="mt-3">
                {g.source === "collection" && (
                  <label className="block text-[12px] text-ink-soft">
                    Collection
                    <select
                      value={g.collection ?? ""}
                      onChange={(e) => edit(i, { collection: e.target.value })}
                      className={field}
                    >
                      <option value="">Choose a collection…</option>
                      {collections.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {g.source === "price" && (
                  <label className="block text-[12px] text-ink-soft">
                    Price limit ($)
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={g.maxPrice ?? 15}
                      onChange={(e) =>
                        edit(i, { maxPrice: Number(e.target.value) || 0 })
                      }
                      className={`${field} w-32`}
                    />
                  </label>
                )}
                {g.source === "products" && (
                  <ProductPicker
                    products={products}
                    chosen={g.slugs ?? []}
                    onChange={(slugs) => edit(i, { slugs })}
                  />
                )}
              </div>

              <p className="mt-3 text-[12px] text-ink-soft">
                {count === 0 ? (
                  <span className="text-[#8e1f0b]">
                    Nothing matches — this guide won&apos;t appear on the page.
                  </span>
                ) : (
                  <>
                    {count} product{count === 1 ? "" : "s"} match
                    {count === 1 ? "es" : ""}, showing {shown}.
                  </>
                )}
              </p>
            </section>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addGuide}
          className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-sand"
        >
          Add a guide
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-lg bg-[#303030] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save gift guides"}
        </button>
        {saved && !dirty && (
          <span className="text-[12px] text-[#0c5132]">Saved</span>
        )}
      </div>
    </div>
  );
}
