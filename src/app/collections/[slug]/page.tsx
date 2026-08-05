import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVisibleCollections, getCollectionBySlug } from "@/lib/collections";
import { getProductsByCollection } from "@/lib/catalog";
import { withInStockFirst } from "@/lib/sort";
import { ProductCard } from "@/components/ProductCard";
import { placeholderImage } from "@/lib/placeholder";
import { getSetting } from "@/lib/settings";
import { collectionHeroKey } from "@/lib/home-image-slots";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getVisibleCollections()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Include hidden so a direct link to a hidden collection still has metadata.
  const collection = await getCollectionBySlug(slug, { includeHidden: true });
  if (!collection) return {};
  // Admin-set search-engine overrides win; otherwise fall back to the copy.
  const description =
    collection.seoDescription ||
    collection.description ||
    `Shop handmade ${collection.name.toLowerCase()} from Threaded Hope — sewn in small batches.`;
  return {
    title: collection.seoTitle || collection.name,
    description,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: {
      title: `${collection.seoTitle || collection.name} · Threaded Hope`,
      description,
      type: "website",
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Hidden collections aren't listed but remain reachable by direct URL.
  const collection = await getCollectionBySlug(slug, { includeHidden: true });
  if (!collection) notFound();

  const items = withInStockFirst(await getProductsByCollection(slug));
  // Admin-uploaded banner (Photos tab) falls back to the generated pattern.
  // The collection's own banner wins; the Photos tab upload is the fallback for
  // banners set before collections carried their own image.
  const hero =
    collection.heroImage ||
    (await getSetting(collectionHeroKey(slug))) ||
    placeholderImage(collection.name, collection.hue);

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="font-serif text-4xl text-ink">{collection.name}</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            {collection.description}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="mb-5 text-sm text-ink-soft">
          {items.length} product{items.length === 1 ? "" : "s"}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
