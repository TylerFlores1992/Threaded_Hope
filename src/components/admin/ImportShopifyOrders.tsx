"use client";

import { useState } from "react";
import {
  importShopifyOrdersBatch,
  importShopifyCustomers,
  importParsedOrders,
} from "@/app/admin/(panel)/orders/import/actions";
import type { ImportProgress } from "@/app/admin/(panel)/orders/import/actions";
import { parseShopifyOrdersCsv } from "@/lib/shopify-csv";

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
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMsg, setCsvMsg] = useState("");
  const [csvError, setCsvError] = useState("");

  /**
   * The CSV is parsed here in the browser and sent up in batches, so a large
   * export never has to fit inside a single request.
   */
  async function importCsv(file: File | undefined) {
    if (!file) return;
    setCsvBusy(true);
    setCsvMsg("Reading file…");
    setCsvError("");
    try {
      const { orders, missingColumns } = parseShopifyOrdersCsv(
        await file.text(),
      );
      if (missingColumns.length > 0) {
        setCsvError(
          `That doesn't look like a Shopify order export — missing ${missingColumns.join(", ")}. In Shopify go to Orders → Export → All orders → CSV.`,
        );
        return;
      }
      if (orders.length === 0) {
        setCsvError("No orders found in that file.");
        return;
      }

      let added = 0;
      let changed = 0;
      const BATCH = 40;
      for (let i = 0; i < orders.length; i += BATCH) {
        const r = await importParsedOrders(orders.slice(i, i + BATCH));
        added += r.imported;
        changed += r.updated;
        setCsvMsg(
          `${Math.min(i + BATCH, orders.length)} of ${orders.length} · ${added} imported · ${changed} updated`,
        );
      }
      const oldestCsv = orders
        .map((o) => o.createdAt)
        .sort()[0]
        ?.slice(0, 10);
      setCsvMsg(
        `Done ✓ ${orders.length} orders in the file · ${added} imported · ${changed} updated${oldestCsv ? ` · oldest ${oldestCsv}` : ""}`,
      );
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setCsvBusy(false);
    }
  }

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
        <h2 className="text-[13px] font-semibold text-ink">
          Full history from a CSV export
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          The API only returns the last 60 days unless Shopify grants the{" "}
          <code>read_all_orders</code> scope. Your CSV export has everything, so
          this is the way to bring the whole history across — no approval needed.
        </p>
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[13px] text-ink-soft">
          <li>In Shopify: Orders → Export → All orders → CSV</li>
          <li>Shopify emails you the file (or downloads it)</li>
          <li>Pick it below</li>
        </ol>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Shopify order export CSV"
          disabled={csvBusy}
          onChange={(e) => {
            void importCsv(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="mt-3 block text-[13px] text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-[#303030] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-white hover:file:bg-[#1a1a1a]"
        />
        {csvMsg && (
          <p className="mt-3 rounded-lg bg-sand p-3 text-[13px] text-ink-soft" aria-live="polite">
            {csvMsg}
          </p>
        )}
        {csvError && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
            {csvError}
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
