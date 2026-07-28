/**
 * Re-pull FULL product images from the live Shopify store, including multiple
 * photos per product, and store them on this catalog (Product.images + primary
 * Product.image). Fixes the earlier import where photos were cropped from the
 * collection grid instead of taken from each product's own page.
 *
 * How it works: Shopify exposes every product (with its full images[] array) at
 * `/products.json`. We page through it, match each store product to a DB product
 * by normalized title, download each image at full resolution, upload it to
 * Vercel Blob, and save the ordered list on the product.
 *
 * Requires a configured DB + BLOB_READ_WRITE_TOKEN, and network access to the
 * Shopify store (run it while the store is still up). Preview first:
 *   node --env-file=.env.local scripts/scrape-shopify-images.mjs --dry-run
 *   node --env-file=.env.local scripts/scrape-shopify-images.mjs
 *
 * Flags:
 *   --dry-run           show matches + photo counts, write nothing
 *   --store <domain>    Shopify domain (default threadedhope.myshopify.com)
 *   --only-missing      only update products that currently have <2 images
 */
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_MISSING = args.includes("--only-missing");
const storeIdx = args.indexOf("--store");
const STORE =
  storeIdx !== -1 && args[storeIdx + 1] && !args[storeIdx + 1].startsWith("--")
    ? args[storeIdx + 1]
    : "threadedhope.myshopify.com";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Fetch all products (with images) from the store's public products.json. */
async function fetchShopifyProducts() {
  const byTitle = new Map();
  for (let page = 1; page <= 50; page++) {
    const url = `https://${STORE}/products.json?limit=250&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Shopify fetch failed (${res.status}) for ${url}`);
    const data = await res.json();
    const products = data.products ?? [];
    if (products.length === 0) break;
    for (const p of products) {
      const imgs = (p.images ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((im) => im.src)
        .filter(Boolean);
      if (imgs.length > 0) byTitle.set(norm(p.title), imgs);
    }
    if (products.length < 250) break;
  }
  return byTitle;
}

async function uploadFromUrl(srcUrl, slug, i) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`image fetch ${res.status}: ${srcUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (srcUrl.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg").toLowerCase();
  const blob = await put(`products/${slug}-${i + 1}.${ext}`, buf, {
    access: "public",
    contentType: res.headers.get("content-type") || `image/${ext}`,
    addRandomSuffix: true,
  });
  return blob.url;
}

async function main() {
  console.log(`Fetching products from ${STORE} …`);
  const shopify = await fetchShopifyProducts();
  console.log(`Store has ${shopify.size} products with photos.`);

  const dbProducts = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, images: true },
  });

  let matched = 0;
  let updated = 0;
  let unmatched = [];

  for (const p of dbProducts) {
    const srcs = shopify.get(norm(p.name));
    if (!srcs) {
      unmatched.push(p.name);
      continue;
    }
    matched++;

    const currentCount = Array.isArray(p.images) ? p.images.length : 0;
    if (ONLY_MISSING && currentCount >= 2) continue;

    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}${p.slug}: ${srcs.length} photo(s)`,
    );
    if (DRY_RUN) {
      updated++;
      continue;
    }

    const urls = [];
    for (let i = 0; i < srcs.length; i++) {
      try {
        urls.push(await uploadFromUrl(srcs[i], slugify(p.name), i));
      } catch (e) {
        console.warn(`  ! skipped image ${i + 1}: ${e.message}`);
      }
    }
    if (urls.length === 0) continue;

    await prisma.product.update({
      where: { id: p.id },
      data: { images: urls, image: urls[0] },
    });
    updated++;
  }

  console.log(
    `\nMatched ${matched}/${dbProducts.length}. ${DRY_RUN ? "Would update" : "Updated"} ${updated}.`,
  );
  if (unmatched.length) {
    console.log(`Unmatched (${unmatched.length}):`);
    for (const n of unmatched) console.log(`  - ${n}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
