"use client";

import { useState, useTransition } from "react";
import { setStock } from "@/app/admin/(panel)/inventory/actions";

export function StockField({
  id,
  initial,
}: {
  id: string;
  initial: number | null;
}) {
  const [value, setValue] = useState(initial?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const commit = () => {
    if (value === (initial?.toString() ?? "")) return;
    startTransition(async () => {
      await setStock(id, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
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
        className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-sage-deep"
      />
      {pending && <span className="text-xs text-ink-soft">saving…</span>}
      {saved && !pending && <span className="text-xs text-sage-deep">✓</span>}
    </span>
  );
}
