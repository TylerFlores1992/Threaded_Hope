import { prisma, isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { formatPrice } from "@/lib/format";
import { StatStrip } from "@/components/admin/StatStrip";
import { sizeAxisOf, optionAxesOf } from "@/lib/stock";
import type { Variant } from "@/data/products";
import {
  AdminInventoryTable,
  type AdminInventoryItem,
} from "@/components/admin/AdminInventoryTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to manage inventory.
      </p>
    );
  }

  const collections = await getAllCollections();
  const rows = await prisma.product.findMany({
    orderBy: [{ stock: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  const items: AdminInventoryItem[] = rows.map((p) => {
    const stored = Array.isArray(p.collections) ? (p.collections as string[]) : [];
    const variants = (Array.isArray(p.variants) ? p.variants : []) as Variant[];
    const axis = sizeAxisOf({ variants });
    const sizeStock =
      p.sizeStock && typeof p.sizeStock === "object"
        ? (p.sizeStock as Record<string, number>)
        : {};
    const optionStock =
      p.optionStock && typeof p.optionStock === "object"
        ? (p.optionStock as Record<string, Record<string, number>>)
        : {};
    return {
      id: p.id,
      name: p.name,
      image: p.image ?? undefined,
      collections:
        stored.length > 0
          ? Array.from(new Set([p.collectionSlug, ...stored]))
          : [p.collectionSlug],
      stock: p.stock,
      inStock: p.inStock,
      // Per-size rows when the product has a size axis (price-driving or "size").
      sizes: axis
        ? axis.options.map((o) => ({ label: o, count: sizeStock[o] ?? null }))
        : null,
      // Colour/style groups each get their own counts, just like sizes do.
      optionGroups: optionAxesOf({ variants }).map((v) => ({
        name: v.name,
        options: v.options.map((o) => ({
          label: o,
          count: optionStock[v.name]?.[o] ?? null,
        })),
      })),
    };
  });

  // Units on hand and what they're worth, across tracked products.
  const unitsOnHand = rows.reduce((n, p) => n + (p.stock ?? 0), 0);
  const inventoryValueCents = rows.reduce(
    (n, p) => n + (p.stock ?? 0) * p.priceCents,
    0,
  );

  const soldOut = rows.filter((p) => !p.inStock).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {/* Route handler returning a file download — a plain <a> is correct. */}
        { }
        <a
          href="/admin/inventory/export"
          className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03]"
        >
          Export
        </a>
      </div>

      <StatStrip
        period="Right now"
        stats={[
          { label: "Products", value: String(rows.length) },
          { label: "Units on hand", value: String(unitsOnHand) },
          {
            label: "Retail value on hand",
            value: formatPrice(inventoryValueCents / 100),
          },
          { label: "Sold out", value: String(soldOut) },
        ]}
      />

      <p className="mb-3 mt-3 text-[12px] text-ink-soft">
        Set a count to track a product; leave blank for untracked. Products with
        sizes — or colours and other options — show a count per choice, and a
        choice at 0 shows as sold out on the storefront. Counts drop
        automatically when an order is paid.
      </p>

      <AdminInventoryTable
        items={items}
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
