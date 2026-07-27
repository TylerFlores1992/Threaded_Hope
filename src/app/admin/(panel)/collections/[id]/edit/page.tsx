import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import type { Collection } from "@/data/collections";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { updateCollection } from "../../actions";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <Link href="/admin/collections" className="text-sm text-ink-soft">
        ← Collections
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-3xl text-ink">
        Edit “{row.name}”
      </h1>
      <CollectionForm
        action={action}
        collection={collection}
        submitLabel="Save changes"
      />
    </div>
  );
}
