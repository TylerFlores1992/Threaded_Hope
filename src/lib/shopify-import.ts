import "server-only";
import { put } from "@vercel/blob";

/**
 * Pull full-resolution product photos (multiple per product) from the live
 * Shopify store's public `/products.json` and store them on the catalog. Used by
 * the admin "Import photos" batch action so it can run on Vercel (where the DB +
 * Blob token live) instead of a local script.
 */
export const DEFAULT_STORE = "threadedhope.myshopify.com";

export const normTitle = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** normalized title → ordered list of full-res image URLs */
export async function fetchShopifyImageMap(
  store = DEFAULT_STORE,
): Promise<Map<string, string[]>> {
  const byTitle = new Map<string, string[]>();
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(
      `https://${store}/products.json?limit=250&page=${page}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Shopify fetch failed (${res.status})`);
    const data = (await res.json()) as {
      products?: { title: string; images?: { src: string; position?: number }[] }[];
    };
    const products = data.products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      const imgs = (p.images ?? [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((im) => im.src)
        .filter(Boolean);
      if (imgs.length > 0) byTitle.set(normTitle(p.title), imgs);
    }
    if (products.length < 250) break;
  }
  return byTitle;
}

/** Download each source image and upload it to Blob; returns the new URLs. */
export async function uploadImagesFromUrls(
  srcs: string[],
  name: string,
): Promise<string[]> {
  const slug = slugify(name);
  const urls: string[] = [];
  for (let i = 0; i < srcs.length; i++) {
    try {
      const res = await fetch(srcs[i], { cache: "no-store" });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext =
        (srcs[i].split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg").toLowerCase();
      const blob = await put(`products/${slug}-${i + 1}.${ext}`, buf, {
        access: "public",
        contentType: res.headers.get("content-type") || `image/${ext}`,
        addRandomSuffix: true,
      });
      urls.push(blob.url);
    } catch {
      /* skip a bad image, keep the rest */
    }
  }
  return urls;
}
