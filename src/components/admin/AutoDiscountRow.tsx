"use client";

import { useTransition } from "react";
import { toggleRule, deleteRule } from "@/app/admin/(panel)/discounts/actions";

export function AutoDiscountRow({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => toggleRule(id, !active))}
        className="text-ink-soft hover:text-ink disabled:opacity-50"
      >
        {active ? "Pause" : "Activate"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (confirm("Delete this discount rule?")) await deleteRule(id);
          })
        }
        className="text-red-700 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
