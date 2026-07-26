/**
 * Strip emoji/pictographs from product descriptions already in the database
 * (they came in from the Shopify import). Safe to re-run; only updates rows whose
 * description actually changes.
 *
 * Requires a configured database. Run:
 *   node --env-file=.env.local --import tsx scripts/clean-descriptions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Emoji / pictograph / dingbat ranges + variation selectors.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/gu;

function clean(text: string): string {
  return text
    .replace(EMOJI, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, description: true },
  });
  let updated = 0;
  for (const p of products) {
    const cleaned = clean(p.description);
    if (cleaned !== p.description) {
      await prisma.product.update({
        where: { id: p.id },
        data: { description: cleaned },
      });
      console.log(`✓ ${p.slug}`);
      updated++;
    }
  }
  console.log(`Done. ${updated} description(s) cleaned.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
