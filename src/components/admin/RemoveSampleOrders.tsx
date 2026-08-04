"use client";

import { useState, useTransition } from "react";
import { deleteSampleOrders } from "@/app/admin/(panel)/orders/actions";

/**
 * One-click cleanup for the placeholder orders created while Shippo was in
 * test mode. Only rendered when some exist, so it disappears once they're gone.
 */
export function RemoveSampleOrders({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#ffd6a4] px-3 py-2 text-[13px] text-[#5e4200]">
      <span>
        {count} sample order{count === 1 ? "" : "s"} left over from test mode.
      </span>
      <button
        onClick={() =>
          start(async () => {
            await deleteSampleOrders();
            setDone(true);
          })
        }
        disabled={pending}
        className="rounded-lg bg-[#5e4200] px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove them"}
      </button>
    </div>
  );
}
