import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/data/blog";
import { store } from "@/data/store";
import { SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} · ${store.name}`,
      description: post.excerpt,
      type: "article",
      url: `${SITE_URL}/blog/${post.slug}`,
      // See the note in the collection page: declaring `openGraph` drops the
      // root opengraph-image, so it has to be named again here.
      images: [{ url: "/opengraph-image" }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: store.name },
    publisher: { "@type": "Organization", name: store.name },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <JsonLd data={articleSchema} />
      <Link href="/blog" className="text-sm text-ink-soft hover:text-sage-deep">
        ← Journal
      </Link>
      <p className="mt-4 text-xs uppercase tracking-wide text-ink-soft">
        {new Date(post.date).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <h1 className="mt-1 font-serif text-4xl text-ink">{post.title}</h1>

      <div className="prose-content mt-8 space-y-5 text-lg leading-relaxed text-ink-soft">
        {post.body.map((block, i) => {
          if (block.type === "h2") {
            return (
              <h2 key={i} className="!mt-10 font-serif text-2xl text-ink">
                {block.text}
              </h2>
            );
          }
          if (block.type === "ul") {
            return (
              <ul key={i} className="list-disc space-y-2 pl-6">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          }
          return <p key={i}>{block.text}</p>;
        })}
      </div>

      <div className="mt-10 border-t border-border pt-8 text-center">
        <p className="font-serif text-xl text-ink">Find your one-of-a-kind piece</p>
        <Link
          href="/shop"
          className="mt-4 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
        >
          Shop handmade
        </Link>
      </div>
    </article>
  );
}
