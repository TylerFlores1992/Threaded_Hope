/**
 * Sync product details from the live Shopify store into this catalog:
 *   • FULL description (Shopify `body_html` → clean text; the original import
 *     kept only the first couple of sentences)
 *   • per-size / overall AVAILABILITY (Shopify `variants[].available`)
 *   • unit WEIGHT (Shopify `variants[].grams` → ounces) for shipping labels
 *
 * NOTE ON STOCK NUMBERS: Shopify's public `/products.json` exposes only
 * `available: true|false` per variant — never the quantity. So this can mark
 * things in/out of stock, but it cannot import counts. Getting real numbers
 * requires Shopify Admin API credentials (a custom app token with
 * read_inventory); see docs/SETUP.md.
 *
 * Products are matched to the store by title. Safe to re-run.
 *
 *   node --env-file=.env.local scripts/sync-shopify-details.mjs --dry-run
 *   node --env-file=.env.local scripts/sync-shopify-details.mjs
 *
 * Flags:
 *   --dry-run          report what would change, write nothing
 *   --store <domain>   default threadedhope.myshopify.com
 *   --skip-stock       don't touch availability (descriptions/weights only)
 *   --skip-weight      don't touch weightOz
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_STOCK = args.includes("--skip-stock");
const SKIP_WEIGHT = args.includes("--skip-weight");
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

/** Shopify body_html → readable plain text with blank lines between blocks. */
function htmlToText(html) {
  if (!html) return "";
  return (
    String(html)
      // Drop non-content elements entirely.
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      // List items become bullets.
      .replace(/<li[^>]*>/gi, "\n• ")
      // Block ends become paragraph breaks.
      .replace(/<\/(p|div|ul|ol|li|h[1-6]|tr)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      // Decode the entities Shopify actually emits.
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&rsquo;/gi, "'")
      .replace(/&lsquo;/gi, "'")
      .replace(/&ldquo;|&rdquo;/gi, '"')
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      // Tidy whitespace.
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

async function fetchShopify() {
  const byTitle = new Map();
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(
      `https://${STORE}/products.json?limit=250&page=${page}`,
    );
    if (!res.ok) throw new Error(`Shopify fetch failed (${res.status})`);
    const { products = [] } = await res.json();
    if (products.length === 0) break;
    for (const p of products) byTitle.set(norm(p.title), p);
    if (products.length < 250) break;
  }
  return byTitle;
}

async function main() {
  console.log(`Fetching ${STORE} …`);
  const shopify = await fetchShopify();
  console.log(`${shopify.size} products in the store.\n`);

  const rows = await prisma.product.findMany();
  let matched = 0;
  let changed = 0;
  const unmatched = [];

  for (const row of rows) {
    const sp = shopify.get(norm(row.name));
    if (!sp) {
      unmatched.push(row.name);
      continue;
    }
    matched++;

    const data = {};
    const notes = [];

    // 1) Full description.
    const full = htmlToText(sp.body_html);
    if (full && full !== row.description) {
      data.description = full;
      notes.push(`description ${row.description.length}→${full.length} chars`);
    }

    // 2) Availability (NOT counts — Shopify's public feed has no quantities).
    if (!SKIP_STOCK) {
      const variants = sp.variants ?? [];
      const anyAvailable = variants.some((v) => v.available);
      // Per-size availability maps onto sizeStock only for sizes we track: a
      // sold-out size becomes 0; an available size is left untracked (blank)
      // so we never invent a count.
      const current =
        row.sizeStock && typeof row.sizeStock === "object"
          ? { ...row.sizeStock }
          : {};
      const next = { ...current };
      for (const v of variants) {
        const label = String(v.title ?? "").trim();
        if (!label || label.toLowerCase() === "default title") continue;
        if (!v.available) next[label] = 0;
        else if (next[label] === 0) delete next[label]; // back in stock
      }
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        data.sizeStock = next;
        notes.push("per-size availability");
      }
      if (row.inStock !== anyAvailable) {
        data.inStock = anyAvailable;
        notes.push(`inStock ${row.inStock}→${anyAvailable}`);
      }
    }

    // 3) Weight (grams → ounces), first variant with a real weight.
    if (!SKIP_WEIGHT) {
      const grams = (sp.variants ?? []).map((v) => v.grams).find((g) => g > 0);
      if (grams) {
        const oz = Math.round((grams / 28.3495) * 10) / 10;
        if (row.weightOz !== oz) {
          data.weightOz = oz;
          notes.push(`weight ${oz}oz`);
        }
      }
    }

    if (Object.keys(data).length === 0) continue;
    changed++;
    console.log(`${DRY_RUN ? "[dry-run] " : ""}${row.slug}: ${notes.join(", ")}`);
    if (!DRY_RUN) {
      await prisma.product.update({ where: { id: row.id }, data });
    }
  }

  console.log(
    `\nMatched ${matched}/${rows.length}. ${DRY_RUN ? "Would update" : "Updated"} ${changed}.`,
  );
  if (unmatched.length) {
    console.log(`\nUnmatched by title (${unmatched.length}):`);
    for (const n of unmatched) console.log(`  - ${n}`);
  }
  if (!SKIP_STOCK) {
    console.log(
      "\nNote: Shopify's public feed has no stock quantities — only in/out of " +
        "stock. Set real counts in the admin Inventory page.",
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
