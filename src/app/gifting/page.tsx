import type { Metadata } from "next";
import Link from "next/link";
import type { Product } from "@/data/products";
import { getProducts } from "@/lib/catalog";
import { withInStockFirst } from "@/lib/sort";
import { getSiteText } from "@/lib/site-text";
import { getGiftingConfig } from "@/lib/gifting";
import { PageIntro } from "@/components/PageIntro";
import { ProductCard } from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Gifting",
  description: "Handmade gift ideas for every person on your list.",
};

/**
 * A product belongs to a collection if it's the primary one *or* it's listed in
 * the product's `collections`. Matching only the primary slug is what left the
 * "For the New Parent" guide empty.
 */
const inCollection = (p: Product, slug: string) =>
  p.collection === slug || (p.collections ?? []).includes(slug);

export const revalidate = 300;

export default async function GiftingPage() {
  const text = await getSiteText();
  const config = await getGiftingConfig();
  const products = await getProducts();
  /** Products for one guide, in the order that guide implies. */
  const itemsFor = (g: (typeof config.guides)[number]) => {
    if (g.source === "products") {
      // Hand-picked keeps the chosen order, so it reads as a curated row.
      const bySlug = new Map(products.map((p) => [p.slug, p]));
      return (g.slugs ?? [])
        .map((slug) => bySlug.get(slug))
        .filter((p): p is Product => Boolean(p));
    }
    if (g.source === "price") {
      const max = g.maxPrice ?? Infinity;
      return withInStockFirst(products.filter((p) => p.price <= max));
    }
    return withInStockFirst(
      products.filter((p) => inCollection(p, g.collection ?? "")),
    );
  };

  return (
    <div>
      <PageIntro
        title={text.gifting_heading}
        subtitle={text.gifting_subtitle}
      />

      {config.guides.map((guide) => {
        const matches = itemsFor(guide);
        // A "see more" tile takes a grid cell, so it replaces the last product
        // rather than wrapping onto a row of its own with three empty cells
        // beside it. The limit stays the number of cells the row occupies.
        const hasMore = matches.length > guide.limit;
        const items = matches.slice(0, hasMore ? guide.limit - 1 : guide.limit);
        // An empty guide is worse than no guide — it reads as a broken page.
        if (matches.length === 0) return null;

        /**
         * Where "see more" goes, and whether it's earned. A hand-picked guide
         * has no page listing exactly that selection, so it never shows one —
         * raise its limit instead.
         */
        const moreHref = !hasMore
          ? null
          : guide.source === "collection" && guide.collection
            ? `/collections/${guide.collection}`
            : guide.source === "price" && guide.maxPrice
              ? `/shop?maxPrice=${guide.maxPrice}`
              : null;
        // A hand-picked guide has no destination, so it keeps its full row.
        const shown = moreHref ? items : matches.slice(0, guide.limit);
        return (
          <section key={guide.key} className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-5">
              <h2 className="font-serif text-2xl text-ink">{guide.heading}</h2>
              {guide.blurb && <p className="text-ink-soft">{guide.blurb}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {shown.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
              {moreHref && (
                <Link
                  href={moreHref}
                  /* Card-shaped so it reads as a tile even when it wraps onto
                     a row of its own, which it does whenever the guide's limit
                     fills the grid exactly. */
                  className="group flex aspect-4/5 flex-col items-center justify-center rounded-2xl bg-sand text-center ring-1 ring-border transition hover:bg-sage-deep"
                >
                  <span className="font-serif text-lg font-semibold text-ink transition group-hover:text-white">
                    See more
                  </span>
                  <span className="mt-1 px-3 text-sm text-ink-soft transition group-hover:text-cream/90">
                    All {matches.length} →
                  </span>
                </Link>
              )}
            </div>
          </section>
        );
      })}

      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h2 className="font-serif text-2xl text-ink">
          {text.gifting_cta_heading}
        </h2>
        <p className="mt-2 text-ink-soft">{text.gifting_cta_body}</p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
        >
          {text.gifting_cta_button}
        </Link>
      </section>
    </div>
  );
}
