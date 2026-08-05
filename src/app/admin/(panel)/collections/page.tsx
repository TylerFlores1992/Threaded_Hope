import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { placeholderImage } from "@/lib/placeholder";
import { SORT_MODES } from "@/lib/collection-sort";
import { CollectionRowActions } from "@/components/admin/CollectionRowActions";
import { CollectionOrderEditor } from "@/components/admin/CollectionOrderEditor";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
        Connect a database to manage collections.
      </p>
    );
  }

  const collections = await getAllCollections();
  const rows = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      sortMode: true,
      tileImage: true,
      featured: true,
      hidden: true,
      name: true,
    },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  // Product counts and a cover image per collection (primary slug + membership).
  const products = await prisma.product.findMany({
    select: { collectionSlug: true, collections: true, image: true },
  });
  const counts = new Map<string, number>();
  const cover = new Map<string, string>();
  for (const p of products) {
    const stored = Array.isArray(p.collections) ? (p.collections as string[]) : [];
    for (const s of new Set([p.collectionSlug, ...stored])) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
      if (p.image && !cover.has(s)) cover.set(s, p.image);
    }
  }

  const sortLabel = (id: string) =>
    SORT_MODES.find((m) => m.id === id)?.label ?? id;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">Collections</h1>
        <Link
          href="/admin/collections/new"
          className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a]"
        >
          Create collection
        </Link>
      </div>

      <CollectionOrderEditor
        collections={rows.map((r) => ({
          id: r.id,
          name: r.name,
          image: r.tileImage ?? cover.get(r.slug),
          featured: r.featured,
          hidden: r.hidden,
        }))}
      />

      <div className="mt-4 overflow-x-auto admin-card">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="w-14 px-3 py-2.5 font-medium">Image</th>
              <th className="px-3 py-2.5 font-medium">Title</th>
              <th className="px-3 py-2.5 font-medium">Products</th>
              <th className="px-3 py-2.5 font-medium">Product ordering</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {collections.map((c) => {
              const row = bySlug.get(c.slug);
              return (
                <tr key={c.slug} className={c.hidden ? "opacity-60" : ""}>
                  <td className="px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        c.tileImage ||
                        cover.get(c.slug) ||
                        placeholderImage(c.name, c.hue)
                      }
                      alt=""
                      className="h-9 w-9 rounded object-cover ring-1 ring-border"
                      loading="lazy"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/collections/${row?.id ?? ""}/edit`}
                      className="font-medium text-ink hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="block text-[11px] text-ink-soft">
                      /collections/{c.slug}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {counts.get(c.slug) ?? 0}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {sortLabel(row?.sortMode ?? "manual")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {c.hidden ? (
                        <span className="rounded-lg bg-[#e3e3e3] px-2 py-0.5 text-[12px] font-medium text-[#4a4a4a]">
                          Hidden
                        </span>
                      ) : (
                        <span className="rounded-lg bg-[#cdfee1] px-2 py-0.5 text-[12px] font-medium text-[#0c5132]">
                          Active
                        </span>
                      )}
                      {c.featured && (
                        <span className="rounded-lg bg-[#e3e3e3] px-2 py-0.5 text-[12px] font-medium text-[#4a4a4a]">
                          Featured
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <CollectionRowActions
                      id={row?.id ?? ""}
                      name={c.name}
                      hidden={!!c.hidden}
                    />
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
