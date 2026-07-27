"use client";

import { useState, useTransition } from "react";
import { setSizeStock } from "@/app/admin/(panel)/inventory/actions";

/** Inline per-size stock input. Blank = untracked (always available); 0 = sold out. */
export function SizeStockField({
  id,
  size,
  initial,
}: {
  id: string;
  size: string;
  initial: number | null;
}) {
  const [value, setValue] = useState(initial?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const commit = () => {
    if (value === (initial?.toString() ?? "")) return;
    startTransition(async () => {
      await setSizeStock(id, size, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <label className="inline-flex items-center gap-1 text-xs">
      <span className="text-ink-soft">{size}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        placeholder="—"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-14 rounded-lg border border-border bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sage-deep"
      />
      {pending && <span className="text-ink-soft">…</span>}
      {saved && !pending && <span className="text-sage-deep">✓</span>}
    </label>
  );
}
