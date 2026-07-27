"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  setCollectionHidden,
  deleteCollection,
} from "@/app/admin/(panel)/collections/actions";

export function CollectionRowActions({
  id,
  name,
  hidden,
}: {
  id: string;
  name: string;
  hidden: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const toggleHidden = () =>
    startTransition(() => setCollectionHidden(id, !hidden));

  const remove = () =>
    startTransition(async () => {
      if (!confirm(`Delete the “${name}” collection?`)) return;
      const res = await deleteCollection(id);
      if (!res.ok && res.error) alert(res.error);
    });

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <Link
        href={`/admin/collections/${id}/edit`}
        className="text-sage-deep hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={toggleHidden}
        disabled={pending}
        className="text-ink-soft hover:text-ink disabled:opacity-50"
      >
        {hidden ? "Show" : "Hide"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-red-700 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
