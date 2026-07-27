import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/data/blog";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = {
  title: "Journal — Handmade Stories & Gift Guides",
  description:
    "Stories from the sewing table: handmade gift guides, how our bags and pouches are made, and fabric-care tips from Threaded Hope.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  return (
    <div>
      <PageIntro
        title="Journal"
        subtitle="Stories from the sewing table — gift guides, how things are made, and care tips."
      />
      <div className="mx-auto max-w-3xl px-4 py-14">
        <ul className="space-y-8">
          {posts.map((post) => (
            <li
              key={post.slug}
              className="border-b border-border pb-8 last:border-0"
            >
              <p className="text-xs uppercase tracking-wide text-ink-soft">
                {new Date(post.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <h2 className="mt-1 font-serif text-2xl text-ink">
                <Link href={`/blog/${post.slug}`} className="hover:text-sage-deep">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-ink-soft">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-block text-sm font-medium text-sage-deep hover:underline"
              >
                Read more →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
