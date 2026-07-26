/**
 * Backfill each product's collection membership in the database from the static
 * catalog (`src/data/products.ts`), which carries the real Threaded Hope
 * memberships. Updates `collections` (and re-asserts the primary `collectionSlug`)
 * by slug — it does NOT touch price, stock, images, or any other admin edits,
 * and is safe to re-run.
 *
 * Requires a configured database. Run:
 *   node --env-file=.env.local --import tsx scripts/backfill-collections.ts
 */
import { PrismaClient } from "@prisma/client";
import { products } from "../src/data/products";

const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  let missing = 0;
  for (const p of products) {
    const row = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (!row) {
      missing++;
      continue;
    }
    await prisma.product.update({
      where: { slug: p.slug },
      data: { collectionSlug: p.collection, collections: p.collections },
    });
    if (p.collections.length > 1) {
      console.log(`✓ ${p.slug} → ${p.collections.join(", ")}`);
    }
    updated++;
  }
  console.log(
    `Done. ${updated} products updated${
      missing ? `, ${missing} not found in DB (skipped)` : ""
    }.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
