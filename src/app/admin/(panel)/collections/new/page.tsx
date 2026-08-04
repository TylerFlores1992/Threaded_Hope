import Link from "next/link";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { createCollection } from "../actions";
import { SORT_MODES } from "@/lib/collection-sort";

export const dynamic = "force-dynamic";

export default function NewCollectionPage() {
  return (
    <div>
      <Link href="/admin/collections" className="text-sm text-ink-soft">
        ← Collections
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-3xl text-ink">New collection</h1>
      <CollectionForm
        action={createCollection}
        submitLabel="Create collection"
        sortModes={SORT_MODES}
      />
    </div>
  );
}
