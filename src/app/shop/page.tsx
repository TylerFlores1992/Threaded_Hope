import type { Metadata } from "next";
import { getProducts } from "@/lib/catalog";
import { getVisibleCollections } from "@/lib/collections";
import { ShopClient } from "@/components/ShopClient";

export const metadata: Metadata = {
  title: "Shop Handmade Bags, Pouches & Gifts",
  description:
    "Browse every handmade piece from Threaded Hope — bags, zipper pouches, " +
    "tote bags, keychains, and faith-based gifts, each sewn in small batches.",
  alternates: { canonical: "/shop" },
};

// Revalidate periodically so catalog edits in the admin appear; admin mutations
// also call revalidatePath for instant updates.
export const revalidate = 300;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const products = await getProducts();
  const collections = await getVisibleCollections();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-ink">Shop All Products</h1>
        <p className="mt-2 text-ink-soft">
          Handmade fabric accessories, made in small batches with care.
        </p>
      </header>
      <ShopClient
        products={products}
        collections={collections}
        initialQuery={q ?? ""}
      />
    </div>
  );
}
