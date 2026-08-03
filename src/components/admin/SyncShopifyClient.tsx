"use client";

import { useState } from "react";
import {
  syncShopifyBatch,
  type SyncProgress,
} from "@/app/admin/(panel)/products/sync/actions";

/** Drives the Shopify detail sync in batches so it can run from a phone. */
export function SyncShopifyClient() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setDone(false);
    setError("");
    setProcessed(0);
    setUpdated(0);
    setUnmatched([]);

    let offset = 0;
    const seen: string[] = [];
    try {
      for (;;) {
        const r: SyncProgress = await syncShopifyBatch(offset);
        setTotal(r.total);
        setProcessed(Math.min(r.nextOffset, r.total));
        setUpdated((u) => u + r.updated);
        seen.push(...r.unmatched);
        setUnmatched([...seen]);
        if (r.done) break;
        offset = r.nextOffset;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  }

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="max-w-xl">
      <p className="text-sm text-ink-soft">
        Pulls each product’s <strong>full description</strong> from your Shopify
        store, plus in/out-of-stock and item weight. Matched by product name.
        Safe to re-run.
      </p>
      <p className="mt-2 text-xs text-ink-soft">
        Note: Shopify’s public data doesn’t include stock <em>numbers</em> — only
        whether something is in stock. Set counts on the Inventory page.
      </p>

      <button
        onClick={run}
        disabled={running}
        className="mt-4 rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage disabled:opacity-60"
      >
        {running ? "Syncing…" : done ? "Run again" : "Start sync"}
      </button>

      {(running || done) && (
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
            <div
              className="h-full bg-sage-deep transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {processed}/{total} products · {updated} updated
            {running ? " · working…" : done ? " · done ✓" : ""}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error} — tap Start again to resume.
        </p>
      )}

      {done && unmatched.length > 0 && (
        <div className="mt-5 rounded-lg bg-sand p-4 text-sm">
          <p className="font-medium text-ink">
            {unmatched.length} product{unmatched.length === 1 ? "" : "s"} didn’t
            match a Shopify product by name (edit those by hand):
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-soft">
            {unmatched.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
