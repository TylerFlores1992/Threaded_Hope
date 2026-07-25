import type { Metadata } from "next";
import { products } from "@/data/products";
import { ShopClient } from "@/components/ShopClient";

export const metadata: Metadata = {
  title: "Shop All Products",
  description: "Browse all handmade fabric accessories from Threaded Hope.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-ink">Shop All Products</h1>
        <p className="mt-2 text-ink-soft">
          Handmade fabric accessories, made in small batches with care.
        </p>
      </header>
      <ShopClient products={products} initialQuery={q ?? ""} />
    </div>
  );
}
