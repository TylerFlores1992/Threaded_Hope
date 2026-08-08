import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { getProducts } from "@/lib/catalog";
import { getGiftingConfig } from "@/lib/gifting";
import { GiftGuidesEditor } from "@/components/admin/GiftGuidesEditor";

export const dynamic = "force-dynamic";

/**
 * The gift guides, under Online Store with the other storefront pages — it's a
 * page you edit, not a property of a collection.
 */
export default async function AdminGiftsPage() {
  if (!isDbConfigured()) {
    return (
      <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
        Connect a database to edit the gift guides.
      </p>
    );
  }

  const [collections, products, config] = await Promise.all([
    getAllCollections(),
    getProducts(),
    getGiftingConfig(),
  ]);

  return (
    <div className="max-w-3xl">
      <p className="text-[13px] text-ink-soft">
        The rows of products down your{" "}
        <Link href="/gifting" className="text-sage-deep underline">
          gift guide
        </Link>
        . Add as many as you like, in any order. The page&apos;s own title and
        closing block are under{" "}
        <Link href="/admin/text" className="text-sage-deep underline">
          Site text
        </Link>
        .
      </p>

      <div className="mt-4">
        <GiftGuidesEditor
          collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
          products={products.map((p) => ({
            slug: p.slug,
            name: p.name,
            price: p.price,
            image: p.image,
            collections: Array.from(
              new Set([p.collection, ...(p.collections ?? [])]),
            ),
          }))}
          guides={config.guides}
        />
      </div>
    </div>
  );
}
