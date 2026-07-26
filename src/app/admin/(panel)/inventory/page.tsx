import { prisma, isDbConfigured } from "@/lib/db";
import { collections } from "@/data/collections";
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

  const rows = await prisma.product.findMany({
    orderBy: [{ stock: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  const items: AdminInventoryItem[] = rows.map((p) => {
    const stored = Array.isArray(p.collections) ? (p.collections as string[]) : [];
    return {
      id: p.id,
      name: p.name,
      collections:
        stored.length > 0
          ? Array.from(new Set([p.collectionSlug, ...stored]))
          : [p.collectionSlug],
      stock: p.stock,
      inStock: p.inStock,
    };
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Inventory</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Set a stock count to track a product; leave blank for untracked. Stock
        auto-decrements when an order is paid, and items hitting 0 are marked
        sold out.
      </p>

      <AdminInventoryTable
        items={items}
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
