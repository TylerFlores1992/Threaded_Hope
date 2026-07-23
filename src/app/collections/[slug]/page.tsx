import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { collections, collectionBySlug } from "@/data/collections";
import { productsByCollection } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { placeholderImage } from "@/lib/placeholder";

export function generateStaticParams() {
  return collections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = collectionBySlug(slug);
  if (!collection) return {};
  return { title: collection.name, description: collection.description };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = collectionBySlug(slug);
  if (!collection) notFound();

  const items = productsByCollection(slug);

  return (
    <div>
      {/* Banner */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={placeholderImage(collection.name, collection.hue)}
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
