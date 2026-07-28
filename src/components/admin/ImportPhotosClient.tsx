"use client";

import { useState } from "react";
import {
  importPhotosBatch,
  type ImportProgress,
} from "@/app/admin/(panel)/products/import-photos/actions";

/**
 * Drives the photo import in small batches so it runs on the server (Vercel has
 * the DB + Blob token) without any single request timing out. Works from a phone
 * — just tap Start.
 */
export function ImportPhotosClient() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [matched, setMatched] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setDone(false);
    setError("");
    setProcessed(0);
    setMatched(0);
    setUpdated(0);
    setUnmatched([]);

    let offset = 0;
    const seenUnmatched: string[] = [];
    try {
      // Loop until the server reports it's done.
      for (;;) {
        const r: ImportProgress = await importPhotosBatch(offset, onlyMissing);
        setTotal(r.total);
        setProcessed(Math.min(r.nextOffset, r.total));
        setMatched((m) => m + r.matched);
        setUpdated((u) => u + r.updated);
        seenUnmatched.push(...r.unmatched);
        setUnmatched([...seenUnmatched]);
        if (r.done) break;
        offset = r.nextOffset;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  }

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="max-w-xl">
      <p className="text-sm text-ink-soft">
        Pulls the full-resolution photos (several per product) from your Shopify
        store and saves them here. Matched by product name. Safe to re-run.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={onlyMissing}
          disabled={running}
          onChange={(e) => setOnlyMissing(e.target.checked)}
        />
        Only products with fewer than 2 photos
      </label>

      <button
        onClick={run}
        disabled={running}
        className="mt-4 rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage disabled:opacity-60"
      >
        {running ? "Importing…" : done ? "Run again" : "Start import"}
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
            {processed}/{total} products · {updated} updated · {matched} matched
            {running ? " · working…" : done ? " · done ✓" : ""}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error} — you can tap Start again to resume.
        </p>
      )}

      {done && unmatched.length > 0 && (
        <div className="mt-5 rounded-lg bg-sand p-4 text-sm">
          <p className="font-medium text-ink">
            {unmatched.length} product{unmatched.length === 1 ? "" : "s"} didn’t
            match a Shopify product by name (edit photos manually):
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
