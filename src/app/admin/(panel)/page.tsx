import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import {
  MetricsCard,
  type MetricSeries,
} from "@/components/admin/MetricsCard";
import { RangePicker } from "@/components/admin/RangePicker";
import {
  DEFAULT_RANGE,
  bucketKey,
  isRangeId,
  resolveRange,
} from "@/lib/date-range";

export const dynamic = "force-dynamic";

type Tone = "live" | "test" | "off";

/** One integration's status — shows mode only, never the secret value. */
function StatusRow({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: Tone;
  note?: string;
}) {
  const dot =
    tone === "live"
      ? "bg-[#29845a]"
      : tone === "test"
        ? "bg-amber-500"
        : "bg-taupe";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
      <span className="text-ink-soft">{label}</span>
      <span className="flex items-center gap-2">
        {note && <span className="text-xs text-ink-soft">{note}</span>}
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="font-medium text-ink">{value}</span>
      </span>
    </div>
  );
}

/** Read-only config health — reads env server-side, exposes only the mode. */
function setupStatus() {
  const stripe = process.env.STRIPE_SECRET_KEY ?? "";
  const shippo = process.env.SHIPPO_API_KEY ?? "";
  const shopify =
    process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET;
  const rows: { label: string; value: string; tone: Tone; note?: string }[] = [
    {
      label: "Payments (Stripe)",
      value: stripe.startsWith("sk_live_")
        ? "Live"
        : stripe.startsWith("sk_test_")
          ? "Test"
          : "Not set",
      tone: stripe.startsWith("sk_live_")
        ? "live"
        : stripe.startsWith("sk_test_")
          ? "test"
          : "off",
    },
    {
      label: "Stripe webhook secret",
      value: process.env.STRIPE_WEBHOOK_SECRET ? "Set" : "Not set",
      tone: process.env.STRIPE_WEBHOOK_SECRET ? "live" : "off",
    },
    {
      label: "Shipping labels (Shippo)",
      value: shippo.startsWith("shippo_live_")
        ? "Live"
        : shippo.startsWith("shippo_test_")
          ? "Test"
          : "Not set",
      tone: shippo.startsWith("shippo_live_")
        ? "live"
        : shippo.startsWith("shippo_test_")
          ? "test"
          : "off",
    },
    {
      label: "Order emails (Resend)",
      value: process.env.RESEND_API_KEY ? "On" : "Off",
      tone: process.env.RESEND_API_KEY ? "live" : "off",
      note: process.env.EMAIL_FROM,
    },
    {
      label: "Shopify sync (Admin API)",
      value: shopify ? "Connected" : "Not set",
      tone: shopify ? "live" : "off",
      note: process.env.SHOPIFY_STORE_DOMAIN,
    },
    {
      label: "Sales tax",
      value:
        process.env.STRIPE_TAX_ENABLED === "1"
          ? "Auto (Stripe Tax)"
          : process.env.STRIPE_TAX_RATE_ID
            ? "Flat rate"
            : "Off",
      tone:
        process.env.STRIPE_TAX_ENABLED === "1" || process.env.STRIPE_TAX_RATE_ID
          ? "live"
          : "off",
    },
  ];
  return rows;
}

/** Percent change, or null when the previous period had nothing to compare to. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  if (!isDbConfigured() || !prisma) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-ink">Home</h1>
        <p className="mt-4 rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
          No database is connected yet. Add a Postgres database (DATABASE_* env
          vars) and redeploy to enable the admin.
        </p>
      </div>
    );
  }

  // Single impure clock read for the whole page.
  const now = new Date();
  const range = resolveRange(
    isRangeId(rangeParam) ? rangeParam : DEFAULT_RANGE,
    now,
  );

  const [productCount, orderCount, revenue, toShip, ordersWindow, viewsWindow] =
    await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      // Refunds come off revenue — money that went back to a customer was
      // never really earned, and a headline that ignores them overstates sales.
      prisma.order.aggregate({
        _sum: { amountTotalCents: true, refundedCents: true },
      }),
      // A fully refunded order isn't a parcel waiting to go out. Compared as a
      // field reference so the database does it, rather than loading every
      // unfulfilled order to filter in memory.
      prisma.order.count({
        where: {
          fulfillmentStatus: "unfulfilled",
          refundedCents: { lt: prisma.order.fields.amountTotalCents },
        },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: range.start } },
        select: {
          createdAt: true,
          amountTotalCents: true,
          refundedCents: true,
          items: true,
        },
      }),
      prisma.pageview.findMany({
        where: { createdAt: { gte: range.start } },
        select: { createdAt: true },
      }),
    ]);

  // Bucket both periods at the range's granularity (days, or months for the
  // long ranges) so every metric lines up point for point.
  const zero = (keys: string[]) => new Map(keys.map((k) => [k, 0]));
  const salesCur = zero(range.currentKeys);
  const salesPrev = zero(range.previousKeys);
  const ordersCur = zero(range.currentKeys);
  const ordersPrev = zero(range.previousKeys);
  const viewsCur = zero(range.currentKeys);
  const viewsPrev = zero(range.previousKeys);

  for (const o of ordersWindow) {
    const k = bucketKey(o.createdAt, range.bucketing);
    // A refund is booked against the order's own date, not the day it was
    // issued, so the chart keeps matching the order list.
    const net = o.amountTotalCents - o.refundedCents;
    if (salesCur.has(k)) {
      salesCur.set(k, (salesCur.get(k) ?? 0) + net);
      ordersCur.set(k, (ordersCur.get(k) ?? 0) + 1);
    } else if (salesPrev.has(k)) {
      salesPrev.set(k, (salesPrev.get(k) ?? 0) + net);
      ordersPrev.set(k, (ordersPrev.get(k) ?? 0) + 1);
    }
  }
  for (const v of viewsWindow) {
    const k = bucketKey(v.createdAt, range.bucketing);
    if (viewsCur.has(k)) viewsCur.set(k, (viewsCur.get(k) ?? 0) + 1);
    else if (viewsPrev.has(k)) viewsPrev.set(k, (viewsPrev.get(k) ?? 0) + 1);
  }

  const series = (m: Map<string, number>, keys: string[]) =>
    keys.map((k) => m.get(k) ?? 0);
  const sum = (a: number[]) => a.reduce((n, v) => n + v, 0);

  const sessionsCurArr = series(viewsCur, range.currentKeys);
  const sessionsPrevArr = series(viewsPrev, range.previousKeys);
  const salesCurArr = series(salesCur, range.currentKeys);
  const salesPrevArr = series(salesPrev, range.previousKeys);
  const ordersCurArr = series(ordersCur, range.currentKeys);
  const ordersPrevArr = series(ordersPrev, range.previousKeys);

  const sessionsTotal = sum(sessionsCurArr);
  const sessionsPrevTotal = sum(sessionsPrevArr);
  const revenueTotal = sum(salesCurArr);
  const revenuePrevTotal = sum(salesPrevArr);
  const ordersTotal = sum(ordersCurArr);
  const ordersPrevTotal = sum(ordersPrevArr);

  // Conversion per bucket, so the chart shows the trend rather than one number.
  const convSeries = (o: number[], s: number[]) =>
    o.map((v, i) => (s[i] > 0 ? (v / s[i]) * 100 : 0));
  const conversion =
    sessionsTotal > 0 ? (ordersTotal / sessionsTotal) * 100 : null;
  const conversionPrev =
    sessionsPrevTotal > 0 ? (ordersPrevTotal / sessionsPrevTotal) * 100 : null;

  const metrics: MetricSeries[] = [
    {
      id: "sales",
      label: "Total sales",
      display: formatPrice(revenueTotal / 100),
      delta: pctChange(revenueTotal, revenuePrevTotal),
      current: salesCurArr,
      previous: salesPrevArr,
      unit: "money",
    },
    {
      id: "orders",
      label: "Orders",
      display: String(ordersTotal),
      delta: pctChange(ordersTotal, ordersPrevTotal),
      current: ordersCurArr,
      previous: ordersPrevArr,
      unit: "count",
    },
    {
      id: "sessions",
      label: "Sessions",
      display: sessionsTotal.toLocaleString(),
      delta: pctChange(sessionsTotal, sessionsPrevTotal),
      current: sessionsCurArr,
      previous: sessionsPrevArr,
      unit: "count",
    },
    {
      id: "conversion",
      label: "Conversion rate",
      display: conversion == null ? "—" : `${conversion.toFixed(2)}%`,
      delta:
        conversion != null && conversionPrev != null
          ? pctChange(conversion, conversionPrev)
          : null,
      current: convSeries(ordersCurArr, sessionsCurArr),
      previous: convSeries(ordersPrevArr, sessionsPrevArr),
      unit: "percent",
    },
  ];

  // Best sellers over the selected period only.
  const unitsByName = new Map<string, number>();
  for (const o of ordersWindow) {
    if (o.createdAt < range.currentStart) continue;
    const items = (Array.isArray(o.items) ? o.items : []) as {
      name?: string;
      quantity?: number;
    }[];
    for (const it of items) {
      const name = it.name ?? "Item";
      unitsByName.set(name, (unitsByName.get(name) ?? 0) + (it.quantity ?? 1));
    }
  }
  const bestSellers = [...unitsByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const recent = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[12px] text-ink-soft">All channels</p>
            <h1 className="text-[15px] font-semibold text-ink">{range.label}</h1>
          </div>
          <RangePicker value={range.id} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/products/new", label: "Add product" },
            { href: "/admin/orders/new", label: "Record a sale" },
            { href: "/admin/customize", label: "Home page" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03]"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <MetricsCard
        metrics={metrics}
        labels={range.labels}
        rangeLabel={range.rangeLabel}
        previousLabel={range.previousLabel}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="admin-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink">Recent orders</h2>
            <Link href="/admin/orders" className="text-[13px] text-[#005bd3]">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-[13px] text-ink-soft">
              No orders yet. Paid orders appear here and in your Stripe
              Dashboard.
            </p>
          ) : (
            <ul className="divide-y divide-border text-[13px]">
              {recent.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-[#005bd3] hover:underline"
                  >
                    {o.customerName ?? o.email ?? "—"}
                  </Link>
                  <span className="font-medium text-ink">
                    {formatPrice(o.amountTotalCents / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card p-4">
          <h2 className="text-[13px] font-semibold text-ink">Best sellers</h2>
          <p className="text-[11px] text-ink-soft">
            Units sold, {range.label.toLowerCase()}
          </p>
          {bestSellers.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-soft">No sales yet.</p>
          ) : (
            <ol className="mt-2 space-y-1.5 text-[13px]">
              {bestSellers.map(([name, units]) => (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink">{name}</span>
                  <span className="shrink-0 font-medium text-ink-soft">
                    {units}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Products", value: String(productCount) },
          { label: "Orders, all time", value: String(orderCount) },
          {
            label: "Revenue, all time",
            value: formatPrice(
              ((revenue._sum.amountTotalCents ?? 0) -
                (revenue._sum.refundedCents ?? 0)) /
                100,
            ),
          },
          { label: "To ship", value: String(toShip) },
        ].map((s) => (
          <div key={s.label} className="admin-card p-4">
            <p className="text-[12px] text-ink-soft">{s.label}</p>
            <p className="mt-0.5 text-[19px] font-semibold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-4">
        <h2 className="mb-2 text-[13px] font-semibold text-ink">Setup status</h2>
        <div className="admin-card divide-y divide-border">
          {setupStatus().map((r) => (
            <StatusRow key={r.label} {...r} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          Green = live · amber = test mode · grey = not set. Modes only — no keys
          are shown.
        </p>
      </section>
    </div>
  );
}
