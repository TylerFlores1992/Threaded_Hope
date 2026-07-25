/**
 * Move product photos from the Threaded Hope Shopify CDN into Vercel Blob, so
 * the storefront serves its own images and no longer hotlinks Shopify.
 *
 * For every product whose `image` still points at cdn.shopify.com, it downloads
 * the photo, uploads it to Vercel Blob, and rewrites `product.image` to the new
 * Blob URL. Idempotent: products already on Blob (or with no image) are skipped,
 * so it's safe to re-run.
 *
 * Requires a configured database and Blob token:
 *   DATABASE_POSTGRES_PRISMA_URL  (+ DATABASE_POSTGRES_URL_NON_POOLING)
 *   BLOB_READ_WRITE_TOKEN
 *
 * Run:  npm run migrate:images        (add --dry-run to preview without writing)
 */
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const DRY_RUN = process.argv.includes("--dry-run");
const SHOPIFY_HOST = "cdn.shopify.com";

function needsMigration(url) {
  if (!url) return false;
  try {
    return new URL(url).hostname.includes(SHOPIFY_HOST);
  } catch {
    return false;
  }
}

// Derive a stable, web-friendly Blob key from the product slug + source URL.
function blobKey(slug, srcUrl) {
  let ext = "jpg";
  try {
    const path = new URL(srcUrl).pathname;
    const m = path.match(/\.(jpe?g|png|webp|gif|heic)(?:$|\?)/i);
    // Shopify serves HEIC uploads as JPEG bytes, so normalize heic -> jpg.
    if (m) ext = m[1].toLowerCase() === "heic" ? "jpg" : m[1].toLowerCase();
  } catch {
    /* fall back to jpg */
  }
  return `products/${slug}.${ext}`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "BLOB_READ_WRITE_TOKEN is not set — create a Vercel Blob store and add its token first.",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      select: { id: true, slug: true, name: true, image: true },
      orderBy: { createdAt: "asc" },
    });

    const todo = products.filter((p) => needsMigration(p.image));
    console.log(
      `${products.length} products; ${todo.length} to migrate` +
        (DRY_RUN ? " (dry run)" : "") +
        ".",
    );

    let migrated = 0;
    let failed = 0;
    for (const p of todo) {
      try {
        const res = await fetch(p.image);
        if (!res.ok) throw new Error(`download HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const bytes = Buffer.from(await res.arrayBuffer());

        if (DRY_RUN) {
          console.log(`· would migrate ${p.slug} (${bytes.length} bytes)`);
          migrated++;
          continue;
        }

        const { url } = await put(blobKey(p.slug, p.image), bytes, {
          access: "public",
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        await prisma.product.update({
          where: { id: p.id },
          data: { image: url },
        });
        console.log(`✓ ${p.slug} → ${url}`);
        migrated++;
      } catch (err) {
        failed++;
        console.error(`✗ ${p.slug}: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(
      `Done. ${migrated} migrated, ${failed} failed, ${
        products.length - todo.length
      } skipped.`,
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
