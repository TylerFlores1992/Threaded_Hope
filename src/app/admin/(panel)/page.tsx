import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  /** Percent change vs. the previous period; omitted when there's no baseline. */
  delta?: number | null;
}) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-border">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-serif text-3xl text-ink">{value}</p>
      {delta != null && (
        <p
          className={`mt-1 text-xs font-medium ${
            delta >= 0 ? "text-sage-deep" : "text-red-700"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}% vs. previous 30
          days
        </p>
      )}
    </div>
  );
}

/** Percent change, or null when the previous period had nothing to compare to. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

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
      ? "bg-sage-deep"
      : tone === "test"
        ? "bg-amber-500"
        : "bg-taupe";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
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
  const rows: {
    label: string;
    value: string;
    tone: Tone;
    note?: string;
  }[] = [
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

export default async function AdminDashboard() {
  if (!isDbConfigured() || !prisma) {
    return (
      <div>
        <h1 className="font-serif text-3xl text-ink">Dashboard</h1>
        <p className="mt-4 rounded-lg bg-sand p-4 text-sm text-ink-soft">
          No database is connected yet. Add a Postgres database (DATABASE_*
          env vars) and redeploy to enable the admin.
        </p>
      </div>
    );
  }

  const nowMs = new Date().getTime();
  const since = new Date(nowMs - 90 * 24 * 60 * 60 * 1000);
  // Sessions ≈ distinct visits; we count storefront page views over the same
  // 30-day window (and the 30 before it) so every headline number compares.
  const start30 = new Date(nowMs - 30 * 86_400_000);
  const start60 = new Date(nowMs - 60 * 86_400_000);

  const [
    productCount,
    orderCount,
    revenue,
    toShip,
    recent,
    window90,
    sessions30,
    sessionsPrev30,
    ordersPrev30,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { amountTotalCents: true } }),
    prisma.order.count({ where: { fulfillmentStatus: "unfulfilled" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, amountTotalCents: true, items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pageview.count({ where: { createdAt: { gte: start30 } } }),
    prisma.pageview.count({
      where: { createdAt: { gte: start60, lt: start30 } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: start60, lt: start30 } },
      select: { amountTotalCents: true },
    }),
  ]);

  const revenueDollars = (revenue._sum.amountTotalCents ?? 0) / 100;

  // Last 30 days of daily revenue (fill gaps with 0).
  const DAYS = 30;
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    byDay.set(dayKey(new Date(nowMs - i * 86_400_000)), 0);
  }
  let revenue30 = 0;
  for (const o of window90) {
    const k = dayKey(o.createdAt);
    if (byDay.has(k)) {
      byDay.set(k, (byDay.get(k) ?? 0) + o.amountTotalCents);
      revenue30 += o.amountTotalCents;
    }
  }
  const daily = [...byDay.entries()].map(([date, cents]) => ({ date, cents }));
  const maxDay = Math.max(1, ...daily.map((d) => d.cents));

  // Headline numbers for the last 30 days, each against the 30 before it.
  const orders30 = window90.filter(
    (o) => o.createdAt.getTime() >= start30.getTime(),
  ).length;
  const prevOrders30 = ordersPrev30.length;
  const prevRevenue30 = ordersPrev30.reduce(
    (n, o) => n + o.amountTotalCents,
    0,
  );
  // Conversion rate = orders ÷ sessions. Meaningless without traffic, so we
  // show a dash rather than a fake 0%.
  const conversion = sessions30 > 0 ? (orders30 / sessions30) * 100 : null;
  const prevConversion =
    sessionsPrev30 > 0 ? (prevOrders30 / sessionsPrev30) * 100 : null;

  // Best sellers by units sold across the last 90 days.
  const unitsByName = new Map<string, number>();
  for (const o of window90) {
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

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Dashboard</h1>

      {/* Quick actions — the things you do most, one tap away. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { href: "/admin/products/new", label: "+ New product" },
          { href: "/admin/orders/new", label: "+ Record a sale" },
          { href: "/admin/orders", label: "Orders" },
          { href: "/admin/customers", label: "Customers" },
          { href: "/admin/inventory", label: "Update stock" },
          { href: "/admin/customize", label: "Customize site" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink"
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Last 30 days, each compared with the 30 before — like Shopify's home. */}
      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Last 30 days
      </h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Sessions"
          value={sessions30.toLocaleString()}
          delta={pctChange(sessions30, sessionsPrev30)}
        />
        <Stat
          label="Total sales"
          value={formatPrice(revenue30 / 100)}
          delta={pctChange(revenue30, prevRevenue30)}
        />
        <Stat
          label="Orders"
          value={String(orders30)}
          delta={pctChange(orders30, prevOrders30)}
        />
        <Stat
          label="Conversion rate"
          value={conversion == null ? "—" : `${conversion.toFixed(2)}%`}
          delta={
            conversion != null && prevConversion != null
              ? pctChange(conversion, prevConversion)
              : null
          }
        />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        All time
      </h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products" value={String(productCount)} />
        <Stat label="Orders" value={String(orderCount)} />
        <Stat label="Revenue" value={formatPrice(revenueDollars)} />
        <Stat label="To ship" value={String(toShip)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Revenue trend */}
        <section className="rounded-2xl bg-white/70 p-5 ring-1 ring-border lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-xl text-ink">Revenue — last 30 days</h2>
            <span className="font-medium text-sage-deep">
              {formatPrice(revenue30 / 100)}
            </span>
          </div>
          {revenue30 === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No sales in the last 30 days yet.</p>
          ) : (
            <div className="mt-4 flex h-28 items-end gap-[3px]">
              {daily.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${formatPrice(d.cents / 100)}`}
                  className="flex-1 rounded-t bg-sage-deep/80 hover:bg-sage-deep"
                  style={{ height: `${Math.max(2, (d.cents / maxDay) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Best sellers */}
        <section className="rounded-2xl bg-white/70 p-5 ring-1 ring-border">
          <h2 className="font-serif text-xl text-ink">Best sellers</h2>
          <p className="text-xs text-ink-soft">Units sold, last 90 days</p>
          {bestSellers.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No sales yet.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {bestSellers.map(([name, units]) => (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink">{name}</span>
                  <span className="shrink-0 font-medium text-sage-deep">
                    {units}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-xl text-ink">Setup status</h2>
        <div className="divide-y divide-border rounded-2xl bg-white/70 ring-1 ring-border">
          {setupStatus().map((r) => (
            <StatusRow key={r.label} {...r} />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Green = live · amber = test mode · grey = not set. Modes only — no keys
          are shown.
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm text-sage-deep">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No orders yet. Paid orders will appear here and in your Stripe
            Dashboard.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-white/70 ring-1 ring-border">
            {recent.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-ink">{o.email ?? "—"}</span>
                <span className="font-medium text-sage-deep">
                  {formatPrice(o.amountTotalCents / 100)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
