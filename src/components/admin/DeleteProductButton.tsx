"use client";

import { useTransition } from "react";
import { deleteProduct } from "@/app/admin/(panel)/products/actions";

export function DeleteProductButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete "${name}"? This can't be undone.`)) {
          startTransition(() => deleteProduct(id));
        }
      }}
      className="text-red-700 hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
