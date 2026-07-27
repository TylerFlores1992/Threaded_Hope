import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Allow crawling the storefront; keep admin/checkout/api out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/checkout", "/cart", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
