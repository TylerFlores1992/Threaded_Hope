"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RANGES, type RangeId } from "@/lib/date-range";

/**
 * Reporting period selector. The data is server-rendered, so choosing a range
 * navigates with `?range=` rather than refetching in the browser.
 */
export function RangePicker({ value }: { value: RangeId }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={value}
        onChange={(e) =>
          start(() => router.push(`/admin?range=${e.target.value}`))
        }
        aria-label="Reporting period"
        className="rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] outline-none"
      >
        {RANGES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {pending && <span className="text-[12px] text-ink-soft">…</span>}
    </span>
  );
}
