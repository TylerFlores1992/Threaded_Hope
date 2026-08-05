import type { Metadata } from "next";
import { getVisibleCollections } from "@/lib/collections";
import { getCollectionImageOptions } from "@/lib/catalog";
import { getSiteText } from "@/lib/site-text";
import { CollectionTile } from "@/components/CollectionTile";
import { PageIntro } from "@/components/PageIntro";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Browse every Threaded Hope collection — handmade bags, bandanas, quilts and more, sewn in small batches.",
  alternates: { canonical: "/collections" },
};

/**
 * Every collection, as photo tiles. This is where the home page's "View all"
 * tile leads: browsing by collection rather than dropping into the full
 * product list.
 */
export default async function CollectionsPage() {
  const collections = await getVisibleCollections();
  const collImages = await getCollectionImageOptions();
  const text = await getSiteText();

  // Hand each tile a distinct product photo so no two repeat down the page.
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

  return (
    <div>
      <PageIntro
        title={text.home_collections_heading || "Shop by collection"}
        subtitle="Every collection in the shop — pick a corner to wander into."
      />

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {collections.map((c) => (
            <CollectionTile
              key={c.slug}
              collection={c}
              // An admin-set tile photo wins; otherwise borrow a product photo.
              image={c.tileImage ?? pickImage(c.slug)}
            />
          ))}
        </div>

        {collections.length === 0 && (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            No collections yet.
          </p>
        )}
      </section>
    </div>
  );
}
