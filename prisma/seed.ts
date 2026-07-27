/**
 * Seeds the database from the static catalog in `src/data/products.ts`.
 * Idempotent: upserts by slug, so it can be re-run safely.
 *
 * Run with:  npm run db:seed   (after `npm run db:push`)
 */
import { PrismaClient } from "@prisma/client";
import { products } from "../src/data/products";
import { collections } from "../src/data/collections";

const prisma = new PrismaClient();

async function seedCollections() {
  // One-time: only seed when empty, so admin edits are never clobbered.
  const existing = await prisma.collection.count();
  if (existing > 0) {
    console.log(`Collections table already has ${existing} rows — skipping.`);
    return;
  }
  console.log(`Seeding ${collections.length} collections…`);
  for (let i = 0; i < collections.length; i++) {
    const c = collections[i];
    await prisma.collection.create({
      data: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        hue: c.hue,
        featured: c.featured ?? false,
        hidden: c.hidden ?? false,
        sortOrder: i,
      },
    });
  }
}

async function main() {
  await seedCollections();

  // One-time: only seed when the catalog is empty, so redeploys never clobber
  // products created or edited in the admin.
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`Products table already has ${existing} rows — skipping seed.`);
    return;
  }
  console.log(`Seeding ${products.length} products…`);
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        priceCents: Math.round(p.price * 100),
        collectionSlug: p.collection,
        collections: p.collections,
        image: p.image ?? null,
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
        collections: p.collections,
        image: p.image ?? null,
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
