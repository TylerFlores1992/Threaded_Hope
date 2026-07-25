import { prisma, isDbConfigured } from "@/lib/db";
import { StockField } from "@/components/admin/StockField";

export const dynamic = "force-dynamic";

const LOW_STOCK = 3;

export default async function InventoryPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to manage inventory.
      </p>
    );
  }

  const products = await prisma.product.findMany({
    orderBy: [{ stock: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  const tracked = products.filter((p) => p.stock != null);
  const low = tracked.filter((p) => (p.stock ?? 0) <= LOW_STOCK);

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Inventory</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Set a stock count to track a product; leave blank for untracked. Stock
        auto-decrements when an order is paid, and items hitting 0 are marked
        sold out.
      </p>

      <div className="mt-4 flex gap-3 text-sm">
        <span className="rounded-full bg-sand px-3 py-1 text-ink-soft">
          {tracked.length} tracked
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
          {low.length} low / out
        </span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Collection</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => {
              const isLow = p.stock != null && p.stock <= LOW_STOCK;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {p.collectionSlug}
                  </td>
                  <td className="px-4 py-3">
                    <StockField id={p.id} initial={p.stock} />
                  </td>
                  <td className="px-4 py-3">
                    {!p.inStock ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Sold out
                      </span>
                    ) : isLow ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        Low
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">In stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
