import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  products,
  productBySlug,
  relatedProducts,
} from "@/data/products";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { AddToCart } from "@/components/AddToCart";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) return {};
  return { title: product.name, description: product.description };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  const related = relatedProducts(product);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 text-sm text-ink-soft" aria-label="Breadcrumb">
        <Link href="/shop" className="hover:text-sage-deep">
          Shop
        </Link>
        <span className="px-2">/</span>
        <Link
          href={`/collections/${product.collection}`}
          className="hover:text-sage-deep"
        >
          {product.collectionName}
        </Link>
        <span className="px-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl ring-1 ring-border">
          <ProductImage
            name={product.name}
            hue={product.hue}
            priority
            className="aspect-square w-full object-cover"
          />
        </div>

        <div>
          <p className="text-sm uppercase tracking-wide text-ink-soft">
            {product.collectionName}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 text-2xl font-semibold text-sage-deep">
            {formatPrice(product.price)}
          </p>
          <p
            className={`mt-2 text-sm font-medium ${
              product.inStock ? "text-sage-deep" : "text-red-700"
            }`}
          >
            {product.inStock ? "● In stock" : "● Sold out"}
          </p>
          <p className="mt-4 text-ink-soft">{product.description}</p>

          <AddToCart product={product} />

          <ul className="mt-8 space-y-2 border-t border-border pt-6 text-sm text-ink-soft">
            <li>🧵 Handmade in small batches</li>
            <li>🚚 Free shipping on orders over $50</li>
            <li>💌 Easy 30-day returns</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl text-ink">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
