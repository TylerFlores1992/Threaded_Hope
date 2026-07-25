import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to manage products.
      </p>
    );
  }

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">
          Products{" "}
          <span className="text-lg text-ink-soft">({products.length})</span>
        </h1>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-sage-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage"
        >
          + New product
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Collection</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-ink">{p.name}</td>
                <td className="px-4 py-3 text-ink-soft">{p.collectionSlug}</td>
                <td className="px-4 py-3">{formatPrice(p.priceCents / 100)}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {p.stock ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {!p.inStock && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Sold out
                      </span>
                    )}
                    {p.featured && (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-sage-deep">
                        Featured
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="text-sage-deep hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
