import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/data/store";
import { PageIntro } from "@/components/PageIntro";
import { placeholderImage } from "@/lib/placeholder";

export const metadata: Metadata = {
  title: "Our Story",
  description: "The faith, family, and mission behind Threaded Hope.",
};

export default function OurStoryPage() {
  return (
    <div>
      <PageIntro
        title="Our Story"
        subtitle="Faith, family, and a love of handmade — woven into everything we make."
      />

      <article className="mx-auto max-w-3xl px-4 py-14">
        <img
          src={placeholderImage("Our Story", 40)}
          alt="A sunlit sewing table with fabric and thread"
          className="mb-10 w-full rounded-2xl object-cover ring-1 ring-border"
        />

        <div className="prose-content space-y-5 text-lg leading-relaxed text-ink-soft">
          <p>
            {store.name} began the way many small dreams do — at a kitchen table,
            with a borrowed sewing machine and a stack of fabric scraps too pretty to
            throw away. What started as gifts for friends and family slowly grew into
            something more: a little shop built on care, craft, and hope.
          </p>
          <p>
            We believe the everyday things you carry should feel special. A zipper
            pouch that makes you smile. A boo-boo bag that turns tears into giggles. A
            keychain wallet that just works. Each piece is cut, stitched, and finished
            by hand, in small batches, with attention to the details that mass
            production skips.
          </p>

          <h2 className="!mt-10 font-serif text-2xl text-ink">Faith at our heart</h2>
          <p>
            Faith is quietly woven through everything we do. It shapes how we treat our
            customers, how we give back, and the gentle words of encouragement stitched
            into our faith-based line. We&apos;re not here to preach — just to spread a
            little hope, one handmade piece at a time.
          </p>

          <blockquote className="rounded-2xl border-l-4 border-sage-deep bg-sand px-6 py-4 font-serif italic text-ink">
            {store.scripture.text}
            <footer className="mt-2 text-sm not-italic text-ink-soft">
              — {store.scripture.reference}
            </footer>
          </blockquote>

          <h2 className="!mt-10 font-serif text-2xl text-ink">A community, not just a shop</h2>
          <p>
            Every order supports a small, family-run business and the community around
            it. Thank you for being here, for choosing handmade, and for being part of
            our story. We can&apos;t wait to stitch something special for you.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/shop"
            className="inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
          >
            Explore the shop
          </Link>
        </div>
      </article>
    </div>
  );
}
