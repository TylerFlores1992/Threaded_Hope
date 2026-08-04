"use client";

import { useState, useTransition } from "react";
import { setOptionStock } from "@/app/admin/(panel)/inventory/actions";

/**
 * Inline stock input for one option of a non-size group (e.g. Color → Sage).
 * Blank = untracked (always available); 0 = that option shows as sold out.
 */
export function OptionStockField({
  id,
  group,
  option,
  initial,
}: {
  id: string;
  group: string;
  option: string;
  initial: number | null;
}) {
  const [value, setValue] = useState(initial?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const commit = () => {
    if (value === (initial?.toString() ?? "")) return;
    startTransition(async () => {
      await setOptionStock(id, group, option, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <label className="inline-flex items-center gap-1 text-xs">
      <span className="text-ink-soft">{option}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        placeholder="—"
        aria-label={`${group}: ${option} stock`}
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
