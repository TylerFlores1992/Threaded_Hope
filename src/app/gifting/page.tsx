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
        const items = itemsFor(guide).slice(0, guide.limit);
        // An empty guide is worse than no guide — it reads as a broken page.
        if (items.length === 0) return null;
        return (
          <section key={guide.key} className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-5">
              <h2 className="font-serif text-2xl text-ink">{guide.heading}</h2>
              {guide.blurb && <p className="text-ink-soft">{guide.blurb}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
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
