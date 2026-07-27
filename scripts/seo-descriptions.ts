/**
 * Enrich product descriptions in the database with a short, SEO-friendly,
 * keyword-aware sentence — without inventing product specifics. It only APPENDS
 * a tailored line (never rewrites your copy) and is idempotent: products that
 * already carry the Threaded Hope small-batch line are skipped.
 *
 * The appended line varies by product type (bag / pouch / tote / keychain …)
 * and by a deterministic per-slug index, so it isn't identical duplicate text
 * across the catalog.
 *
 * Requires a configured database. Preview first, then apply:
 *   node --env-file=.env.local --import tsx scripts/seo-descriptions.ts --dry-run
 *   node --env-file=.env.local --import tsx scripts/seo-descriptions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Idempotency marker — the phrase every appended line contains.
const MARKER = /small batches by Threaded Hope/i;

function nounFor(name: string, collectionSlug: string): string {
  const s = `${name} ${collectionSlug}`.toLowerCase();
  if (/tote/.test(s)) return "tote bag";
  if (/pouch/.test(s)) return "zipper pouch";
  if (/wallet|card/.test(s)) return "wallet";
  if (/key\s?chain|keychain|key fob|key ring/.test(s)) return "keychain";
  if (/scrunchie/.test(s)) return "scrunchie";
  if (/clutch/.test(s)) return "clutch";
  if (/bag|purse|tote|crossbody|shoulder/.test(s)) return "bag";
  return "handmade piece";
}

function isFaith(name: string, collectionSlug: string): boolean {
  return /faith|cross|christian|scripture|blessed|prayer|jesus|god/i.test(
    `${name} ${collectionSlug}`,
  );
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seoLine(name: string, collectionSlug: string, slug: string): string {
  const noun = nounFor(name, collectionSlug);
  const faith = isFaith(name, collectionSlug);
  const faithGift = faith ? "faith-inspired " : "";
  const variants = [
    `Handmade in small batches by Threaded Hope, this ${noun} is a one-of-a-kind piece made with care — a thoughtful ${faithGift}gift or a little treat for yourself.`,
    `Handmade in small batches by Threaded Hope, each ${noun} is sewn with care and made to last — a unique ${faithGift}handmade gift you won't find anywhere else.`,
    `Handmade in small batches by Threaded Hope. This ${noun} is crafted with care from quality materials${faith ? ", with a faith-filled touch" : ""} — one-of-a-kind and perfect for gifting.`,
  ];
  return variants[hash(slug) % variants.length];
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      collectionSlug: true,
    },
  });

  let updated = 0;
  for (const p of products) {
    const current = (p.description ?? "").trim();
    if (MARKER.test(current)) continue; // already enriched

    const line = seoLine(p.name, p.collectionSlug, p.slug);
    const next = current ? `${current}\n\n${line}` : `${p.name}. ${line}`;

    if (next === current) continue;
    console.log(`✓ ${p.slug}`);
    if (!DRY_RUN) {
      await prisma.product.update({
        where: { id: p.id },
        data: { description: next },
      });
    }
    updated++;
  }

  console.log(
    `${DRY_RUN ? "[dry-run] Would enrich" : "Done. Enriched"} ${updated} description(s).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
