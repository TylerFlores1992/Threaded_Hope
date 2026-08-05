import Link from "next/link";
import { store } from "@/data/store";
import { getVisibleCollections } from "@/lib/collections";
import { getCollectionImageOptions, getProducts } from "@/lib/catalog";
import { getInstagramPosts } from "@/lib/instagram";
import { getHomeImages } from "@/lib/home-images";
import { getSiteText } from "@/lib/site-text";
import { getTheme } from "@/lib/theme";
import { CollectionTile } from "@/components/CollectionTile";
import { ProductCard } from "@/components/ProductCard";
import { Newsletter } from "@/components/Newsletter";

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
  const igPosts = await getInstagramPosts(12);
  const allProducts = await getProducts();
  const homeImages = await getHomeImages();
  const text = await getSiteText();
  const theme = await getTheme();
  // Per-instance section settings (Customize → section settings).
  type S = Record<string, unknown>;
  const str = (s: S, key: string, fallback: string): string =>
    typeof s[key] === "string" && s[key] !== "" ? (s[key] as string) : fallback;
  const bool = (s: S, key: string, fallback: boolean): boolean =>
    typeof s[key] === "boolean" ? (s[key] as boolean) : fallback;
  const num = (s: S, key: string, fallback: number): number => {
    const v = Number(s[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  /** Vertical padding from a section's "Section height" setting. */
  const pad = (s: S): string => {
    const v = str(s, "padding", "normal");
    return v === "compact" ? "py-8 md:py-10" : v === "tall" ? "py-24 md:py-32" : "py-16";
  };

  /** Optional call-to-action button shared by the content blocks. */
  const SectionButton = ({ S, className = "" }: { S: S; className?: string }) => {
    const label = str(S, "buttonLabel", "");
    if (!label) return null;
    return (
      <div className={className}>
        <Link
          href={str(S, "buttonHref", "/shop")}
          className="inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage"
        >
          {label}
        </Link>
      </div>
    );
  };

  /** Per-section background band (Customize → section settings → Background). */
  const bgClass = (s: S): string => {
    switch (str(s, "background", "default")) {
      case "cream":
        return "bg-cream";
      case "sand":
        return "bg-sand";
      case "white":
        return "bg-white";
      default:
        return "";
    }
  };

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
    .slice(0, 12);

  const renderers: Record<string, (S: S) => React.ReactNode> = {
    hero: (S) => (
      <>
{/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className={`mx-auto max-w-3xl px-4 ${
            str(S, "padding", "normal") === "compact"
              ? "py-10 md:py-14"
              : str(S, "padding", "normal") === "tall"
                ? "py-24 md:py-36"
                : "py-16 md:py-24"
          } ${str(S, "align", "center") === "left" ? "text-left" : "text-center"}`}
        >
          <div>
            {bool(S, "showBadge", true) && (
            <p className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sage-deep">
              {text.home_hero_badge}
            </p>
            )}
            <h1 className="mt-4 font-serif text-4xl leading-tight text-ink md:text-5xl">
              {text.home_hero_heading}
            </h1>
            <p className={`mt-4 max-w-xl text-lg text-ink-soft ${str(S, "align", "center") === "left" ? "" : "mx-auto"}`}>
              {text.home_hero_subtitle}
            </p>
            <div className={`mt-7 flex flex-wrap gap-3 ${str(S, "align", "center") === "left" ? "" : "justify-center"}`}>
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
    collections: (S) => (
      <>
{/* Featured collections */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        {/* No "View all" link here — the grid's own View all tile covers it. */}
        <h2 className="mb-6 font-serif text-3xl text-ink">
          {str(S, "heading", text.home_collections_heading)}
        </h2>
        {/* 7 collections + a "View all" tile = 8, filling two even rows. */}
        <div className={`grid grid-cols-2 gap-4 ${str(S, "columns", "4") === "3" ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
          {featuredCollections
            .slice(0, num(S, "tiles", 7))
            .map((c) => (
            <CollectionTile
              key={c.slug}
              collection={c}
              image={c.tileImage ?? tileImages[c.slug]}
            />
          ))}
          {bool(S, "showViewAll", true) && (
          <Link
            href="/collections"
            className="group flex aspect-4/3 flex-col items-center justify-center rounded-2xl bg-sand text-center ring-1 ring-border transition hover:bg-sage-deep"
          >
            <span className="font-serif text-lg font-semibold text-ink transition group-hover:text-white">
              View all
            </span>
            <span className="mt-1 text-sm text-ink-soft transition group-hover:text-cream/90">
              Every collection →
            </span>
          </Link>
          )}
        </div>
      </section>
      </>
    ),
    story: (S) => (
      <>
{/* Our Story teaser */}
      <section>
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          {bool(S, "showImage", true) && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={homeImages.home_story_image ?? homeImages.home_logo ?? "/logo.png"}
              alt={store.name}
              className={`mx-auto w-full max-w-sm rounded-3xl object-contain ${
                str(S, "imagePosition", "left") === "right" ? "md:order-2" : ""
              }`}
            />
          )}
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
    instagram: (S) => (
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
              ? igPosts.slice(0, num(S, "posts", 6)).map((post) => (
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
              : fallbackImages.slice(0, num(S, "posts", 6)).map((src, i) => (
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
    newsletter: (S) => (
      <>
{/* Newsletter */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className={`rounded-3xl px-6 py-12 ring-1 ring-border ${str(S, "cardBackground", "white") === "sand" ? "bg-sand" : "bg-white/70"}`}>
          <Newsletter />
        </div>
      </section>
      </>
    ),

    // ---- Content blocks: all copy and images come from the instance ----
    richtext: (S) => {
      const left = str(S, "align", "center") === "left";
      return (
        <section className={`mx-auto max-w-3xl px-4 ${pad(S)} ${left ? "text-left" : "text-center"}`}>
          {str(S, "heading", "") && (
            <h2 className="font-serif text-3xl text-ink">{str(S, "heading", "")}</h2>
          )}
          {str(S, "body", "") && (
            <p className="mt-4 whitespace-pre-line text-ink-soft">
              {str(S, "body", "")}
            </p>
          )}
          <SectionButton S={S} className="mt-6" />
        </section>
      );
    },

    imageText: (S) => (
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
        {str(S, "image", "") ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={str(S, "image", "")}
            alt=""
            className={`w-full rounded-3xl object-cover ${
              str(S, "imagePosition", "left") === "right" ? "md:order-2" : ""
            }`}
          />
        ) : (
          <div
            className={`flex aspect-4/3 items-center justify-center rounded-3xl bg-sand text-sm text-ink-soft ${
              str(S, "imagePosition", "left") === "right" ? "md:order-2" : ""
            }`}
          >
            Add an image in Customize
          </div>
        )}
        <div>
          {str(S, "heading", "") && (
            <h2 className="font-serif text-3xl text-ink">{str(S, "heading", "")}</h2>
          )}
          {str(S, "body", "") && (
            <p className="mt-4 whitespace-pre-line text-ink-soft">
              {str(S, "body", "")}
            </p>
          )}
          <SectionButton S={S} className="mt-6" />
        </div>
      </section>
    ),

    banner: (S) => {
      const h = str(S, "height", "medium");
      const height =
        h === "short" ? "min-h-[16rem]" : h === "tall" ? "min-h-[32rem]" : "min-h-[24rem]";
      const image = str(S, "image", "");
      return (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div
            className={`relative flex ${height} items-center justify-center overflow-hidden rounded-3xl bg-sand`}
          >
            {image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {image && bool(S, "overlay", true) && (
              <span className="absolute inset-0 bg-ink/40" />
            )}
            <div className="relative px-6 py-12 text-center">
              {str(S, "heading", "") && (
                <h2
                  className={`font-serif text-4xl ${image ? "text-white drop-shadow" : "text-ink"}`}
                >
                  {str(S, "heading", "")}
                </h2>
              )}
              {str(S, "subheading", "") && (
                <p className={`mt-3 text-lg ${image ? "text-white/90" : "text-ink-soft"}`}>
                  {str(S, "subheading", "")}
                </p>
              )}
              <SectionButton S={S} className="mt-6" />
            </div>
          </div>
        </section>
      );
    },

    products: (S) => {
      const slug = str(S, "collection", "");
      const picked = (
        slug ? allProducts.filter((p) => p.collections.includes(slug)) : allProducts
      ).slice(0, num(S, "count", 4));
      if (picked.length === 0) return null;
      const cols = str(S, "columns", "4");
      return (
        <section className="mx-auto max-w-6xl px-4 py-12">
          {str(S, "heading", "") && (
            <h2 className="mb-6 font-serif text-3xl text-ink">{str(S, "heading", "")}</h2>
          )}
          <div
            className={`grid grid-cols-2 gap-4 ${
              cols === "2" ? "md:grid-cols-2" : cols === "3" ? "md:grid-cols-3" : "md:grid-cols-4"
            }`}
          >
            {picked.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
          <SectionButton S={S} className="mt-8 block text-center" />
        </section>
      );
    },

    quote: (S) => (
      <section className={`mx-auto max-w-3xl px-4 text-center ${pad(S)}`}>
        <blockquote className="font-serif text-2xl leading-relaxed text-ink md:text-3xl">
          “{str(S, "quote", "")}”
        </blockquote>
        {str(S, "attribution", "") && (
          <p className="mt-4 text-sm uppercase tracking-wide text-ink-soft">
            {str(S, "attribution", "")}
          </p>
        )}
      </section>
    ),

    iconColumns: (S) => {
      const cols = [1, 2, 3, 4]
        .map((n) => ({
          icon: str(S, `icon${n}`, ""),
          title: str(S, `title${n}`, ""),
          body: str(S, `body${n}`, ""),
        }))
        .filter((c) => c.title || c.body);
      if (cols.length === 0) return null;
      return (
        <section className="mx-auto max-w-6xl px-4 py-12">
          {str(S, "heading", "") && (
            <h2 className="mb-8 text-center font-serif text-3xl text-ink">
              {str(S, "heading", "")}
            </h2>
          )}
          <div
            className={`grid gap-6 sm:grid-cols-2 ${
              cols.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
            }`}
          >
            {cols.map((c, i) => (
              <div key={i} className="text-center">
                {c.icon && <p className="text-3xl">{c.icon}</p>}
                {c.title && (
                  <h3 className="mt-2 font-serif text-lg text-ink">{c.title}</h3>
                )}
                {c.body && <p className="mt-1 text-sm text-ink-soft">{c.body}</p>}
              </div>
            ))}
          </div>
        </section>
      );
    },

    faq: (S) => {
      const items = [1, 2, 3, 4, 5, 6]
        .map((n) => ({ q: str(S, `q${n}`, ""), a: str(S, `a${n}`, "") }))
        .filter((i) => i.q);
      if (items.length === 0) return null;
      return (
        <section className="mx-auto max-w-3xl px-4 py-12">
          {str(S, "heading", "") && (
            <h2 className="mb-6 font-serif text-3xl text-ink">{str(S, "heading", "")}</h2>
          )}
          <div className="divide-y divide-border rounded-2xl bg-white/70 ring-1 ring-border">
            {items.map((item, i) => (
              <details key={i} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-ink-soft transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    },

    spacer: (S) => {
      const size = str(S, "size", "medium");
      const h = size === "small" ? "h-8" : size === "large" ? "h-32" : "h-16";
      return (
        <div className={`mx-auto flex max-w-6xl items-center px-4 ${h}`}>
          {bool(S, "divider", false) && (
            <span className="h-px w-full bg-border" />
          )}
        </div>
      );
    },
  };

  // Render the placed sections in order. The data-section wrapper lets the
  // theme editor scroll to and toggle each one live.
  return (
    <>
      {theme.layout.map((inst) => {
        const render = renderers[inst.type];
        if (!render) return null;
        return (
          <div
            key={inst.key}
            data-section={inst.key}
            hidden={inst.hidden}
            className={bgClass(inst.settings)}
          >
            {render(inst.settings)}
          </div>
        );
      })}
    </>
  );
}
