"use client";

import { useState } from "react";
import {
  importShopifyOrdersBatch,
  importShopifyCustomers,
  type ImportProgress,
} from "@/app/admin/(panel)/orders/import/actions";

/**
 * Walks Shopify's order history in pages from the browser, so a long import
 * can't hit a serverless timeout and progress is visible while it runs.
 */
export function ImportShopifyOrders() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [imported, setImported] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [pages, setPages] = useState(0);
  const [oldest, setOldest] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [customerMsg, setCustomerMsg] = useState("");
  const [customersRunning, setCustomersRunning] = useState(false);

  async function run() {
    setRunning(true);
    setDone(false);
    setError("");
    setImported(0);
    setUpdated(0);
    setPages(0);
    setOldest(null);

    let cursor: string | null = null;
    try {
      for (;;) {
        const r: ImportProgress = await importShopifyOrdersBatch(cursor);
        setImported((n) => n + r.imported);
        setUpdated((n) => n + r.updated);
        setPages((n) => n + 1);
        setOldest((prev) =>
          r.oldestSeen && (!prev || r.oldestSeen < prev) ? r.oldestSeen : prev,
        );
        if (r.done) break;
        cursor = r.nextCursor;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setRunning(false);
    }
  }

  async function runCustomers() {
    setCustomersRunning(true);
    setCustomerMsg("");
    try {
      const r = await importShopifyCustomers();
      setCustomerMsg(r.message);
    } catch (e) {
      setCustomerMsg(e instanceof Error ? e.message : "Customer import failed.");
    } finally {
      setCustomersRunning(false);
    }
  }

  const oldestLabel = oldest
    ? new Date(oldest).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="admin-card p-4">
        <h2 className="text-[13px] font-semibold text-ink">Order history</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Brings every Shopify order across as a real order here — customer,
          items, totals, discounts, shipping, tax and tracking. Imported orders
          are marked <span className="font-medium text-ink">shopify</span> and
          feed your dashboard, best sellers and Customers page. Matched on the
          Shopify order id, so running it again updates rather than duplicates.
        </p>

        <button
          onClick={run}
          disabled={running}
          className="mt-3 rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-60"
        >
          {running ? "Importing…" : done ? "Run again" : "Import orders"}
        </button>

        {(running || done) && (
          <p className="mt-3 text-[13px] text-ink-soft" aria-live="polite">
            {pages} page{pages === 1 ? "" : "s"} · {imported} imported ·{" "}
            {updated} updated
            {oldestLabel && <> · oldest {oldestLabel}</>}
            {running ? " · working…" : " · done ✓"}
          </p>
        )}

        {done && oldestLabel && (
          <p className="mt-2 rounded-lg bg-sand p-3 text-[12px] text-ink-soft">
            Oldest order imported: <strong>{oldestLabel}</strong>. If that&apos;s
            about 60 days ago, Shopify capped the history — reading further back
            needs the <code>read_all_orders</code> scope, which Shopify grants on
            request.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="admin-card p-4">
        <h2 className="text-[13px] font-semibold text-ink">Marketing list</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Customers who bought arrive with their orders. This adds the ones who
          subscribed but never ordered, so your Customers page matches Shopify&apos;s.
        </p>
        <button
          onClick={runCustomers}
          disabled={customersRunning}
          className="mt-3 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03] disabled:opacity-60"
        >
          {customersRunning ? "Importing…" : "Import subscribers"}
        </button>
        {customerMsg && (
          <p className="mt-3 rounded-lg bg-sand p-3 text-[13px] text-ink-soft">
            {customerMsg}
          </p>
        )}
      </div>
    </div>
  );
}
