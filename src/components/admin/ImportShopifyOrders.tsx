"use client";

import { useState } from "react";
import {
  importShopifyCustomers,
  importParsedOrders,
} from "@/app/admin/(panel)/orders/import/actions";
import { parseShopifyOrdersCsv } from "@/lib/shopify-csv";

/**
 * Import Shopify history from a CSV export.
 *
 * The file is parsed here in the browser and posted up in batches, so a large
 * export never has to fit inside a single request, and progress stays visible.
 */
export function ImportShopifyOrders() {
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMsg, setCsvMsg] = useState("");
  const [csvError, setCsvError] = useState("");
  const [customerMsg, setCustomerMsg] = useState("");
  const [customersRunning, setCustomersRunning] = useState(false);

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

  return (
    <div className="max-w-2xl space-y-4">
      <div className="admin-card p-4">
        <h2 className="text-[13px] font-semibold text-ink">Order history</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Brings every Shopify order across as a real order here — customer,
          items, totals, discounts, shipping and tax. Imported orders are marked{" "}
          <span className="font-medium text-ink">shopify</span> and feed your
          dashboard, best sellers and Customers page. Matched on the Shopify
          order id, so running it again updates rather than duplicates.
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
          <p
            className="mt-3 rounded-lg bg-sand p-3 text-[13px] text-ink-soft"
            aria-live="polite"
          >
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
          subscribed but never ordered, so your Customers page matches
          Shopify&apos;s.
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
