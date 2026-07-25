/**
 * Seeds the database from the static catalog in `src/data/products.ts`.
 * Idempotent: upserts by slug, so it can be re-run safely.
 *
 * Run with:  npm run db:seed   (after `npm run db:push`)
 */
import { PrismaClient } from "@prisma/client";
import { products } from "../src/data/products";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${products.length} products…`);
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        priceCents: Math.round(p.price * 100),
        collectionSlug: p.collection,
        variants: p.variants,
        featured: p.featured,
        inStock: p.inStock,
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: Math.round(p.price * 100),
        collectionSlug: p.collection,
        variants: p.variants,
        featured: p.featured,
        inStock: p.inStock,
        createdAt: new Date(p.createdAt),
      },
    });
  }
  console.log("Seed complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
