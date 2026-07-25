import Link from "next/link";
import { store } from "@/data/store";
import { collections } from "@/data/collections";
import { getFeaturedProducts } from "@/lib/catalog";
import { CollectionTile } from "@/components/CollectionTile";
import { ProductCard } from "@/components/ProductCard";
import { Newsletter } from "@/components/Newsletter";
import { placeholderImage } from "@/lib/placeholder";

export const revalidate = 300;

export default async function HomePage() {
  const featuredCollections = collections.filter((c) => c.featured);
  const featured = (await getFeaturedProducts()).slice(0, 8);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sage-deep">
              🧵 Handmade small-batch goods
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-ink md:text-5xl">
              {store.tagline}
            </h1>
            <p className="mt-4 max-w-md text-lg text-ink-soft">{store.heroSubtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage"
              >
                Shop all products
              </Link>
              <Link
                href="/our-story"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink ring-1 ring-border transition hover:bg-sand"
              >
                Our story
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-3">
              {featuredCollections.slice(0, 4).map((c, i) => (
                <img
                  key={c.slug}
                  src={placeholderImage(c.name, c.hue)}
                  alt={c.name}
                  className={`w-full rounded-2xl object-cover ring-1 ring-border ${
                    i % 2 === 0 ? "translate-y-4" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured collections */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-serif text-3xl text-ink">Shop by collection</h2>
          <Link href="/shop" className="text-sm font-medium text-sage-deep hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featuredCollections.map((c) => (
            <CollectionTile key={c.slug} collection={c} />
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-serif text-3xl text-ink">Loved by our community</h2>
          <Link href="/shop" className="text-sm font-medium text-sage-deep hover:underline">
            Shop all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* Our Story teaser */}
      <section className="bg-sand">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <img
            src={placeholderImage("Our Story", 40)}
            alt="A cozy handmade workspace"
            className="w-full rounded-2xl object-cover ring-1 ring-border"
          />
          <div>
            <h2 className="font-serif text-3xl text-ink">Stitched with hope</h2>
            <p className="mt-4 text-ink-soft">
              Every piece from {store.name} begins as a bolt of fabric and a hopeful
              idea. We make in small batches, by hand, with care for the little
              details — because the everyday things you carry should feel special.
            </p>
            <p className="mt-3 text-ink-soft">
              Faith and community are woven into everything we do. Thank you for being
              part of our story.
            </p>
            <Link
              href="/our-story"
              className="mt-6 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage"
            >
              Read our story
            </Link>
          </div>
        </div>
      </section>

      {/* Instagram-style gallery strip */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-center font-serif text-3xl text-ink">
          @threadedhope on Instagram
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {collections.slice(0, 6).map((c) => (
            <a
              key={c.slug}
              href={store.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border"
              aria-label={`${c.name} on Instagram`}
            >
              <img
                src={placeholderImage(c.name, c.hue)}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            </a>
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-white/70 px-6 py-12 ring-1 ring-border">
          <Newsletter />
        </div>
      </section>
    </>
  );
}
