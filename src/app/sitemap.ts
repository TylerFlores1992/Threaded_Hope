import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";
import { getVisibleCollections } from "@/lib/collections";
import { getAllPosts } from "@/data/blog";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/** Dynamic sitemap: static pages + every collection and product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/shop", priority: 0.9, changeFrequency: "daily" },
    { path: "/gifting", priority: 0.7, changeFrequency: "weekly" },
    { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
    { path: "/our-story", priority: 0.6, changeFrequency: "monthly" },
    { path: "/faqs", priority: 0.4, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
    { path: "/shipping-returns", priority: 0.4, changeFrequency: "monthly" },
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((s) => ({
    url: `${SITE_URL}${s.path}`,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  for (const post of getAllPosts()) {
    entries.push({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  try {
    const collections = await getVisibleCollections();
    for (const c of collections) {
      entries.push({
        url: `${SITE_URL}/collections/${c.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    const products = await getProducts();
    for (const p of products) {
      entries.push({
        url: `${SITE_URL}/products/${p.slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    /* DB unavailable → static pages still form a valid sitemap */
  }

  return entries;
}
