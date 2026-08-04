import { prisma, isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { formatPrice } from "@/lib/format";
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

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Inventory</h1>
        {/* Route handler returning a file download — a plain <a> is correct. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/inventory/export"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-sand"
        >
          Export CSV ↓
        </a>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="admin-card p-4">
          <p className="text-sm text-ink-soft">Products</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{rows.length}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-ink-soft">Units on hand</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{unitsOnHand}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-ink-soft">Retail value on hand</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">
            {formatPrice(inventoryValueCents / 100)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-soft">
        Set a stock count to track a product; leave blank for untracked. Products
        with sizes — or colours and other options — show a count per choice; a
        choice at 0 shows as sold out on the storefront. Stock auto-decrements
        when an order is paid.
      </p>

      <AdminInventoryTable
        items={items}
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
