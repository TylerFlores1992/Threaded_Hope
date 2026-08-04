import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { CollectionRowActions } from "@/components/admin/CollectionRowActions";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to manage collections.
      </p>
    );
  }

  const collections = await getAllCollections();
  const rows = await prisma.collection.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  // Product counts per collection (primary slug + membership).
  const products = await prisma.product.findMany({
    select: { collectionSlug: true, collections: true },
  });
  const counts = new Map<string, number>();
  for (const p of products) {
    const stored = Array.isArray(p.collections) ? (p.collections as string[]) : [];
    const slugs = new Set([p.collectionSlug, ...stored]);
    for (const s of slugs) counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">
          Collections{" "}
          <span className="text-lg text-ink-soft">({collections.length})</span>
        </h1>
        <Link
          href="/admin/collections/new"
          className="rounded-lg bg-sage-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage"
        >
          + New collection
        </Link>
      </div>

      <div className="overflow-x-auto admin-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Products</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {collections.map((c) => (
              <tr key={c.slug} className={c.hidden ? "opacity-60" : ""}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 text-ink">
                    <span
                      className="inline-block h-4 w-4 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: `hsl(${c.hue} 40% 75%)` }}
                    />
                    {c.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-soft">{c.slug}</td>
                <td className="px-4 py-3 text-ink-soft">{counts.get(c.slug) ?? 0}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {c.featured && (
                      <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-sage-deep">
                        Featured
                      </span>
                    )}
                    {c.hidden && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Hidden
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <CollectionRowActions
                    id={idBySlug.get(c.slug) ?? ""}
                    name={c.name}
                    hidden={!!c.hidden}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
