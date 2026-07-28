import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProducts,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { priceRange, hasVariablePricing } from "@/lib/pricing";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCard } from "@/components/ProductCard";
import { AddToCart } from "@/components/AddToCart";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { store } from "@/data/store";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const description =
    product.description?.slice(0, 160) ||
    `${product.name} — handmade in small batches by ${store.name}.`;
  const url = `${SITE_URL}/products/${product.slug}`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} · ${store.name}`,
      description,
      url,
      type: "website",
      ...(product.image ? { images: [{ url: product.image }] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);

  const url = `${SITE_URL}/products/${product.slug}`;
  const { min } = priceRange(product);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    ...(product.images.length > 0 ? { image: product.images } : {}),
    brand: { "@type": "Brand", name: store.name },
    category: product.collectionName,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: (min ?? product.price).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: store.name },
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${SITE_URL}/shop` },
      {
        "@type": "ListItem",
        position: 2,
        name: product.collectionName,
        item: `${SITE_URL}/collections/${product.collection}`,
      },
      { "@type": "ListItem", position: 3, name: product.name, item: url },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
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
        <ProductGallery
          name={product.name}
          hue={product.hue}
          images={product.images}
        />

        <div>
          <p className="text-sm uppercase tracking-wide text-ink-soft">
            {product.collectionName}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 text-2xl font-semibold text-sage-deep">
            {hasVariablePricing(product)
              ? `From ${formatPrice(priceRange(product).min)}`
              : formatPrice(product.price)}
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
            <li>Handmade in small batches</li>
            <li>Free shipping on orders over $50</li>
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
