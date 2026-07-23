import type { Metadata } from "next";
import Link from "next/link";
import { collections } from "@/data/collections";
import { products } from "@/data/products";
import { PageIntro } from "@/components/PageIntro";
import { ProductCard } from "@/components/ProductCard";
import { CollectionTile } from "@/components/CollectionTile";

export const metadata: Metadata = {
  title: "Gifting",
  description: "Handmade gift ideas for every person on your list.",
};

type GiftGuide = {
  title: string;
  blurb: string;
  pick: () => typeof products;
};

const giftGuides: GiftGuide[] = [
  {
    title: "Under $15",
    blurb: "Little treasures that make wonderful stocking stuffers.",
    pick: () => products.filter((p) => p.price <= 15).slice(0, 4),
  },
  {
    title: "For the New Parent",
    blurb: "Thoughtful comfort for the moms and dads who do it all.",
    pick: () =>
      products.filter((p) => p.collection === "gifts-for-parents").slice(0, 4),
  },
  {
    title: "For the Pet Lover",
    blurb: "Because the fur babies deserve gifts too.",
    pick: () => products.filter((p) => p.collection === "fur-babies").slice(0, 4),
  },
];

export default function GiftingPage() {
  const giftCollections = collections.filter((c) =>
    ["gifts-for-parents", "faith-based", "fur-babies", "kiddos"].includes(c.slug),
  );

  return (
    <div>
      <PageIntro
        title="Gift Guide"
        subtitle="Handmade with heart — thoughtful gifts for everyone on your list."
      />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 font-serif text-2xl text-ink">Shop gifts by recipient</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {giftCollections.map((c) => (
            <CollectionTile key={c.slug} collection={c} />
          ))}
        </div>
      </section>

      {giftGuides.map((guide) => {
        const items = guide.pick();
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
        <h2 className="font-serif text-2xl text-ink">Need a hand choosing?</h2>
        <p className="mt-2 text-ink-soft">
          We love helping you find the perfect gift. Reach out and we&apos;ll point you
          in the right direction.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
        >
          Contact us
        </Link>
      </section>
    </div>
  );
}
