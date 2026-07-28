import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 ring-1 ring-border">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-serif text-3xl text-ink">{value}</p>
    </div>
  );
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
  const [productCount, orderCount, revenue, toShip, recent, window90] =
    await Promise.all([
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
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
