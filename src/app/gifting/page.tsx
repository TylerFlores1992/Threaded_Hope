import type { Metadata } from "next";
import Link from "next/link";
import { getVisibleCollections } from "@/lib/collections";
import type { Product } from "@/data/products";
import { getProducts, getCollectionImageOptions } from "@/lib/catalog";
import { withInStockFirst } from "@/lib/sort";
import { getSiteText } from "@/lib/site-text";
import { getGiftingConfig } from "@/lib/gifting";
import { PageIntro } from "@/components/PageIntro";
import { ProductCard } from "@/components/ProductCard";
import { CollectionTile } from "@/components/CollectionTile";

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
  // Tiles follow the order chosen in admin, not the collections' own order.
  const bySlug = new Map(
    (await getVisibleCollections()).map((c) => [c.slug, c]),
  );
  const giftCollections = config.tiles
    .map((slug) => bySlug.get(slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // These tiles were showing the generated placeholder pattern, because this
  // page was the only one not handing CollectionTile a photo. Same rule as the
  // home and collections pages: the admin-set tile photo wins, otherwise borrow
  // a product photo, and no two tiles repeat one.
  const collImages = await getCollectionImageOptions();
  const used = new Set<string>();
  const pickImage = (slug: string): string | undefined => {
    for (const img of collImages[slug] ?? []) {
      if (!used.has(img)) {
        used.add(img);
        return img;
      }
    }
    return collImages[slug]?.[0];
  };

  // The price limit is admin-editable copy, so it arrives as a string; a typo
  // falls back to the default rather than emptying the section.
  const budgetMax = Number(text.gifting_guide1_max) || 15;

  const guides = [
    {
      title: text.gifting_guide1_heading,
      blurb: text.gifting_guide1_blurb,
      items: products.filter((p) => p.price <= budgetMax),
    },
    {
      title: text.gifting_guide2_heading,
      blurb: text.gifting_guide2_blurb,
      items: products.filter((p) => inCollection(p, config.guide2)),
    },
    {
      title: text.gifting_guide3_heading,
      blurb: text.gifting_guide3_blurb,
      items: products.filter((p) => inCollection(p, config.guide3)),
    },
  ];

  return (
    <div>
      <PageIntro
        title={text.gifting_heading}
        subtitle={text.gifting_subtitle}
      />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 font-serif text-2xl text-ink">
          {text.gifting_recipients_heading}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {giftCollections.map((c) => (
            <CollectionTile
              key={c.slug}
              collection={c}
              image={c.tileImage ?? pickImage(c.slug)}
            />
          ))}
        </div>
      </section>

      {guides.map((guide) => {
        const items = withInStockFirst(guide.items).slice(0, 4);
        // An empty guide is worse than no guide — it reads as a broken page.
        if (items.length === 0) return null;
        return (
          <section key={guide.title} className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-5">
              <h2 className="font-serif text-2xl text-ink">{guide.title}</h2>
              <p className="text-ink-soft">{guide.blurb}</p>
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
