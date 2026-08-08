import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import type { Collection } from "@/data/collections";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { CollectionItemsEditor } from "@/components/admin/CollectionItemsEditor";
import { updateCollection } from "../../actions";
import { SORT_MODES } from "@/lib/collection-sort";

export const dynamic = "force-dynamic";

/** Manual position of a product within this collection; missing sorts last. */
function positionIn(order: unknown, slug: string): number {
  if (!order || typeof order !== "object") return Number.MAX_SAFE_INTEGER;
  const v = (order as Record<string, unknown>)[slug];
  return typeof v === "number" ? v : Number.MAX_SAFE_INTEGER;
}

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prisma = getPrisma();
  const row = await prisma.collection.findUnique({ where: { id } });
  if (!row) notFound();

  const collection: Collection = {
    slug: row.slug,
    name: row.name,
    description: row.description,
    hue: row.hue,
    featured: row.featured,
    hidden: row.hidden,
  };
  const action = updateCollection.bind(null, id);

  // Products in this collection, in their current manual order.
  const productRows = await prisma.product.findMany({
    where: {
      OR: [
        { collectionSlug: row.slug },
        { collections: { array_contains: row.slug } },
      ],
    },
    select: {
      id: true,
      name: true,
      image: true,
      collectionOrder: true,
      createdAt: true,
    },
  });
  const items = [...productRows]
    .sort(
      (a, b) =>
        positionIn(a.collectionOrder, row.slug) -
          positionIn(b.collectionOrder, row.slug) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map((p) => ({ id: p.id, name: p.name, image: p.image ?? undefined }));

  return (
    <div>
      <Link href="/admin/collections" className="text-sm text-ink-soft">
        ← Collections
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-ink">
        Edit “{row.name}”
      </h1>
      <CollectionForm
        action={action}
        collection={collection}
        submitLabel="Save changes"
        sortMode={row.sortMode}
        sortModes={SORT_MODES}
        seoTitle={row.seoTitle}
        seoDescription={row.seoDescription}
        heroImage={row.heroImage}
        tileImage={row.tileImage}
        photoChoices={items
          .map((i) => i.image)
          .filter((src): src is string => Boolean(src))
          .slice(0, 24)}
      />

      <section className="admin-card mt-4 max-w-3xl p-4">
        <h2 className="mb-1 text-[13px] font-semibold text-ink">
          Collection items{" "}
          <span className="font-normal text-ink-soft">({items.length})</span>
        </h2>
        <p className="mb-3 text-[12px] text-ink-soft">
          Saved separately from the fields above — Save order applies the
          arrangement on its own.
        </p>
        <CollectionItemsEditor
          collectionSlug={row.slug}
          items={items}
          manual={row.sortMode === "manual"}
        />
      </section>
    </div>
  );
}
