import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/data/store";
import { PageIntro } from "@/components/PageIntro";
import { placeholderImage } from "@/lib/placeholder";
import { getHomeImages } from "@/lib/home-images";
import { getSiteText } from "@/lib/site-text";

export const metadata: Metadata = {
  title: "Our Story",
  description: "The faith, family, and mission behind Threaded Hope.",
};

export default async function OurStoryPage() {
  const homeImages = await getHomeImages();
  const text = await getSiteText();
  const storyImage =
    homeImages.our_story_image ?? placeholderImage("Our Story", 40);

  return (
    <div>
      <PageIntro
        title={text.story_title}
        subtitle={text.story_subtitle}
      />

      <article className="mx-auto max-w-3xl px-4 py-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={storyImage}
          alt="A sunlit sewing table with fabric and thread"
          className="mb-10 w-full rounded-2xl object-cover ring-1 ring-border"
        />

        <div className="prose-content space-y-5 text-lg leading-relaxed text-ink-soft">
          {/* Blank lines in the admin field separate paragraphs. */}
          {text.story_body
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}

          <h2 className="!mt-10 font-serif text-2xl text-ink">
            {text.story_verse_heading}
          </h2>
          <p>
            Threaded Hope&apos;s name is inspired by the Bible verse I have leaned on
            through this entire year:
          </p>

          <blockquote className="rounded-2xl border-l-4 border-sage-deep bg-sand px-6 py-4 font-serif italic text-ink">
            {store.scripture.text}
            <footer className="mt-2 text-sm not-italic text-ink-soft">
              — {store.scripture.reference}
            </footer>
          </blockquote>

          <h2 className="!mt-10 font-serif text-2xl text-ink">
            {text.story_made_heading}
          </h2>
          <p>
            At {store.name}, we&apos;re all about creating handmade pieces that bring a
            little extra joy to your day. Every item is made with care, love, and a
            whole lot of hope. From custom bags to unique accessories, each piece has
            its own story and is designed to make life a little brighter.
          </p>
          <p>
            Whether you&apos;re shopping for yourself or looking for the perfect gift,
            we&apos;ve got something special for you. Take a look around and see how
            we&apos;re stitching a bit of hope into every thread.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/shop"
            className="inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
          >
            {text.story_cta}
          </Link>
        </div>
      </article>
    </div>
  );
}
