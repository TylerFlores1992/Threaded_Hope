import { getProducts } from "@/lib/catalog";
import { priceRange, hasVariablePricing } from "@/lib/pricing";
import { store } from "@/data/store";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Google Merchant Center product feed (RSS 2.0 + the `g:` namespace). Lists
 * every product with a real hosted image so items can appear in free Google
 * Shopping listings. Submit this URL in Merchant Center → Products → Feeds.
 */

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isHttp = (u?: string): u is string =>
  typeof u === "string" && /^https?:\/\//.test(u);

export async function GET() {
  const products = await getProducts();

  const items = products
    .filter((p) => isHttp(p.image)) // Google requires a real hosted image
    .map((p) => {
      const link = `${SITE_URL}/products/${p.slug}`;
      const price = hasVariablePricing(p) ? priceRange(p).min : p.price;
      const extra = (p.images ?? [])
        .filter(isHttp)
        .slice(1, 11) // up to 10 additional images
        .map((u) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`)
        .join("\n");

      return `    <item>
      <g:id>${esc(p.slug)}</g:id>
      <title>${esc(p.name)}</title>
      <description>${esc(p.description || p.name)}</description>
      <link>${esc(link)}</link>
      <g:image_link>${esc(p.image as string)}</g:image_link>
${extra ? extra + "\n" : ""}      <g:availability>${p.inStock ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${price.toFixed(2)} USD</g:price>
      <g:condition>new</g:condition>
      <g:brand>${esc(store.name)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${esc(p.collectionName)}</g:product_type>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(store.name)}</title>
    <link>${SITE_URL}</link>
    <description>${esc(store.heroSubtitle)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
