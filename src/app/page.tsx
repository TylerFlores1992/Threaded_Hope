import Link from "next/link";
import { store } from "@/data/store";
import { getVisibleCollections } from "@/lib/collections";
import { getCollectionImageOptions } from "@/lib/catalog";
import { getInstagramPosts } from "@/lib/instagram";
import { getHomeImages } from "@/lib/home-images";
import { getSiteText } from "@/lib/site-text";
import { getTheme } from "@/lib/theme";
import { CollectionTile } from "@/components/CollectionTile";
import { Newsletter } from "@/components/Newsletter";
import { placeholderImage } from "@/lib/placeholder";

export const revalidate = 300;

export default async function HomePage() {
  // Featured collections first, then top up from the rest so the tile grid
  // always fills its 7 slots (+ the "View all" tile = 8, two even rows).
  const visibleCollections = await getVisibleCollections();
  const HOME_TILES = 7;
  const featuredCollections = [
    ...visibleCollections.filter((c) => c.featured),
    ...visibleCollections.filter((c) => !c.featured),
  ].slice(0, HOME_TILES);
  const collImages = await getCollectionImageOptions();
  const igPosts = await getInstagramPosts(6);
  const homeImages = await getHomeImages();
  const text = await getSiteText();
  const theme = await getTheme();

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

  // Collection tiles take distinct photos so nothing repeats on the page.
  const tileImages = Object.fromEntries(
    featuredCollections.map((c) => [c.slug, pickImage(c.slug)]),
  );

  // Instagram strip falls back to recent product photos when no IG feed is
  // configured — again, only ones not already shown above.
  const fallbackImages = Array.from(new Set(Object.values(collImages).flat()))
    .filter((img) => !usedImages.has(img))
    .slice(0, 6);

  const sections: Record<string, React.ReactNode> = {
    hero: (
      <>
{/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sage-deep">
              {text.home_hero_badge}
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-ink md:text-5xl">
              {text.home_hero_heading}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
              {text.home_hero_subtitle}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop"
                className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage"
              >
                {text.home_hero_cta_primary}
              </Link>
              <Link
                href="/our-story"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink ring-1 ring-border transition hover:bg-sand"
              >
                {text.home_hero_cta_secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>
      </>
    ),
    collections: (
      <>
{/* Featured collections */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-serif text-3xl text-ink">
            {text.home_collections_heading}
          </h2>
          <Link href="/shop" className="text-sm font-medium text-sage-deep hover:underline">
            View all →
          </Link>
        </div>
        {/* 7 collections + a "View all" tile = 8, filling two even rows. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featuredCollections.map((c) => (
            <CollectionTile
              key={c.slug}
              collection={c}
              image={tileImages[c.slug]}
            />
          ))}
          <Link
            href="/shop"
            className="group flex aspect-4/3 flex-col items-center justify-center rounded-2xl bg-sand text-center ring-1 ring-border transition hover:bg-sage-deep"
          >
            <span className="font-serif text-lg font-semibold text-ink transition group-hover:text-white">
              View all
            </span>
            <span className="mt-1 text-sm text-ink-soft transition group-hover:text-cream/90">
              Shop everything →
            </span>
          </Link>
        </div>
      </section>
      </>
    ),
    story: (
      <>
{/* Our Story teaser */}
      <section className="bg-sand">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={homeImages.home_story_image ?? homeImages.home_logo ?? "/logo.png"}
            alt={store.name}
            className="mx-auto w-full max-w-sm rounded-3xl object-contain"
          />
          <div>
          <h2 className="font-serif text-3xl text-ink">{text.home_story_heading}</h2>
          <p className="mt-4 whitespace-pre-line text-ink-soft">
            {text.home_story_body_1}
          </p>
          <p className="mt-3 whitespace-pre-line text-ink-soft">
            {text.home_story_body_2}
          </p>
          <Link
            href="/our-story"
            className="mt-6 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage"
          >
            {text.home_story_cta}
          </Link>
          </div>
        </div>
      </section>
      </>
    ),
    instagram: (
      <>
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
      </>
    ),
    newsletter: (
      <>
{/* Newsletter */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-3xl bg-white/70 px-6 py-12 ring-1 ring-border">
          <Newsletter />
        </div>
      </section>
      </>
    ),
  };

  // Render in the admin-configured order, skipping hidden sections. The
  // data-section wrapper also lets the theme editor toggle them live.
  const order = theme.sectionOrder.filter((id) => id in sections);

  return (
    <>
      {order.map((id) => (
        <div key={id} data-section={id} hidden={theme.hiddenSections.includes(id)}>
          {sections[id]}
        </div>
      ))}
    </>
  );
}
