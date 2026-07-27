import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import {
  AdminProductsTable,
  type AdminProduct,
} from "@/components/admin/AdminProductsTable";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to manage products.
      </p>
    );
  }

  const collections = await getAllCollections();
  const rows = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
  });

  const products: AdminProduct[] = rows.map((p) => {
    const stored = Array.isArray(p.collections) ? (p.collections as string[]) : [];
    return {
      id: p.id,
      name: p.name,
      collectionSlug: p.collectionSlug,
      collections:
        stored.length > 0
          ? Array.from(new Set([p.collectionSlug, ...stored]))
          : [p.collectionSlug],
      priceCents: p.priceCents,
      stock: p.stock,
      inStock: p.inStock,
      featured: p.featured,
      createdAt: p.createdAt.getTime(),
    };
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

      <AdminProductsTable
        products={products}
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
