import { prisma, isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { sizeAxisOf } from "@/lib/stock";
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
    return {
      id: p.id,
      name: p.name,
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
    };
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Inventory</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Set a stock count to track a product; leave blank for untracked. Products
        with sizes show a count per size — a size at 0 shows as sold out on the
        storefront. Stock auto-decrements when an order is paid.
      </p>

      <AdminInventoryTable
        items={items}
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
