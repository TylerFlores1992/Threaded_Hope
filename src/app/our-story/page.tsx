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
            I started sewing in my season of waiting — waiting to grow our family, and
            waiting as we healed from the miscarriage of our twin babies.
          </p>
          <p>
            Our miscarriage happened a few weeks after the loss of my grandpa. It was a
            heavy time of grief, and I found myself spending a lot of time with my
            grandma. She shared that she had been leaning on her sewing and petit point
            as a way to help with her grief. She inspired me — and with a little push
            from my husband, I decided to get a sewing machine. And here we are. :)
          </p>
          <p>
            My hope is that this story can encourage anyone who&apos;s in a season of
            waiting. Whether you&apos;re waiting for a job, healing, a spouse, or
            something else — joy and peace can be found in the wait.
          </p>

          <h2 className="!mt-10 font-serif text-2xl text-ink">The verse behind the name</h2>
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

          <h2 className="!mt-10 font-serif text-2xl text-ink">Made with care, love &amp; hope</h2>
          <p>
            At {store.name}, we&apos;re all about creating handmade pieces that bring a
            little extra joy to your day. Every item is made with care, love, and a
            whole lot of hope. From custom bags to unique accessories, each piece has
            its own story and is designed to make life a little brighter.
          </p>
          <p>
            Whether you&apos;re shopping for yourself or looking for the perfect gift,
            we&apos;ve got something special for you. Take a look around and see how
            we&apos;re stitching a bit of hope into every thread. 🫶
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
