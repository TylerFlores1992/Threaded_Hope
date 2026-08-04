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
  // Per-request window for the 30/90-day analytics below.
  const nowMs = new Date().getTime();
  const [rows, recentOrders] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.order.findMany({
      where: { createdAt: { gte: new Date(nowMs - 90 * 86_400_000) } },
      select: { createdAt: true, items: true },
    }),
  ]);

  // Units sold and revenue per slug, over 30 and 90 days.
  const soldUnits30 = new Map<string, number>();
  const revenue90 = new Map<string, number>();
  const cutoff30 = nowMs - 30 * 86_400_000;
  for (const o of recentOrders) {
    const items = (Array.isArray(o.items) ? o.items : []) as {
      slug?: string | null;
      quantity?: number;
      unitAmountCents?: number;
    }[];
    for (const it of items) {
      if (!it.slug) continue;
      const qty = it.quantity ?? 1;
      revenue90.set(
        it.slug,
        (revenue90.get(it.slug) ?? 0) + qty * (it.unitAmountCents ?? 0),
      );
      if (o.createdAt.getTime() >= cutoff30) {
        soldUnits30.set(it.slug, (soldUnits30.get(it.slug) ?? 0) + qty);
      }
    }
  }

  /**
   * ABC analysis: rank products by 90-day revenue, then split on cumulative
   * share — A is the top 80% of revenue, B the next 15%, C the rest. Anything
   * that sold nothing is a C.
   */
  const ranked = [...rows]
    .map((p) => ({ slug: p.slug, revenue: revenue90.get(p.slug) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = ranked.reduce((n, r) => n + r.revenue, 0);
  const grade = new Map<string, "A" | "B" | "C">();
  let cumulative = 0;
  for (const r of ranked) {
    const share = totalRevenue > 0 ? cumulative / totalRevenue : 1;
    grade.set(
      r.slug,
      r.revenue === 0 ? "C" : share < 0.8 ? "A" : share < 0.95 ? "B" : "C",
    );
    cumulative += r.revenue;
  }
  const products: AdminProduct[] = rows.map((p) => {
    const stored = Array.isArray(p.collections) ? (p.collections as string[]) : [];
    return {
      id: p.id,
      name: p.name,
      image: p.image ?? undefined,
      collectionSlug: p.collectionSlug,
      collections:
        stored.length > 0
          ? Array.from(new Set([p.collectionSlug, ...stored]))
          : [p.collectionSlug],
      priceCents: p.priceCents,
      stock: p.stock,
      inStock: p.inStock,
      featured: p.featured,
      status: p.status,
      productType: p.productType,
      vendor: p.vendor,
      abc: grade.get(p.slug) ?? "C",
      unitsSold30: soldUnits30.get(p.slug) ?? 0,
      createdAt: p.createdAt.getTime(),
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">
          Products{" "}
          <span className="text-lg text-ink-soft">({products.length})</span>
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products/sync"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-sand"
          >
            Sync from Shopify
          </Link>
          <Link
            href="/admin/products/new"
            className="rounded-lg bg-sage-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage"
          >
            + New product
          </Link>
        </div>
      </div>

      <AdminProductsTable
        products={products}
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </div>
  );
}
