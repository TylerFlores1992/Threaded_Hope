import Link from "next/link";
import { store } from "@/data/store";
import { getVisibleCollections } from "@/lib/collections";
import { getFeaturedProducts, getCollectionImageOptions } from "@/lib/catalog";
import { getInstagramPosts } from "@/lib/instagram";
import { getHomeImages } from "@/lib/home-images";
import { withInStockFirst } from "@/lib/sort";
import { CollectionTile } from "@/components/CollectionTile";
import { ProductCard } from "@/components/ProductCard";
import { Newsletter } from "@/components/Newsletter";
import { placeholderImage } from "@/lib/placeholder";

export const revalidate = 300;

export default async function HomePage() {
  const featuredCollections = (await getVisibleCollections()).filter(
    (c) => c.featured,
  );
  const collImages = await getCollectionImageOptions();
  const igPosts = await getInstagramPosts(6);
  const homeImages = await getHomeImages();
  const logoSrc = homeImages.home_logo ?? "/logo.png";

  // Hand out a unique image to every slot on the page so nothing repeats.
  const usedImages = new Set<string>();
  const pickImage = (slug: string): string | undefined => {
    for (const img of collImages[slug] ?? []) {
      if (!usedImages.has(img)) {
        usedImages.add(img);
        return img;
      }
    }
    return undefined;
  };

  // Reserve the featured-product photos first (that section shows them by name),
  // so the collage and tiles below pick *other* photos and nothing repeats.
  const featured = withInStockFirst(await getFeaturedProducts()).slice(0, 8);
  featured.forEach((p) => p.image && usedImages.add(p.image));

  // Hero collage (top of page), then the tiles take the next distinct photos.
  // An admin override (home_hero_1..4) wins over the auto-picked photo.
  const heroCollage = featuredCollections.slice(0, 4).map((c, i) => {
    const override = homeImages[`home_hero_${i + 1}`];
    return {
      name: c.name,
      slug: c.slug,
      image: override ?? pickImage(c.slug) ?? placeholderImage(c.name, c.hue),
    };
  });
  const tileImages = Object.fromEntries(
    featuredCollections.map((c) => [c.slug, pickImage(c.slug)]),
  );

  // Instagram strip falls back to recent product photos when no IG feed is
  // configured — again, only ones not already shown above.
  const fallbackImages = Array.from(new Set(Object.values(collImages).flat()))
    .filter((img) => !usedImages.has(img))
    .slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sage-deep">
              Handmade small-batch goods
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
              {heroCollage.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  className={`group relative block aspect-square overflow-hidden rounded-2xl ring-1 ring-border ${
                    i % 2 === 0 ? "translate-y-4" : ""
                  }`}
                  aria-label={c.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt={c.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </Link>
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
            <CollectionTile
              key={c.slug}
              collection={c}
              image={tileImages[c.slug]}
            />
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={homeImages.home_story_image ?? logoSrc}
            alt={store.name}
            className="mx-auto w-full max-w-sm rounded-3xl object-contain"
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

      {/* Instagram strip — latest posts (auto-updates), or recent product photos */}
      {(igPosts.length > 0 || fallbackImages.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-center font-serif text-3xl text-ink">
            <a
              href={store.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sage-deep"
            >
              @{store.socials.instagramHandle} on Instagram
            </a>
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {igPosts.length > 0
              ? igPosts.map((post) => (
                  <a
                    key={post.id}
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.imageUrl}
                      alt={post.caption?.slice(0, 100) ?? "Instagram post"}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </a>
                ))
              : fallbackImages.map((src, i) => (
                  <a
                    key={i}
                    href={store.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border"
                    aria-label="Threaded Hope on Instagram"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </a>
                ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-white/70 px-6 py-12 ring-1 ring-border">
          <Newsletter />
        </div>
      </section>
    </>
  );
}
