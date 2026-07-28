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

  const [productCount, orderCount, revenue, toShip, recent] =
    await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { amountTotalCents: true } }),
      prisma.order.count({ where: { fulfillmentStatus: "unfulfilled" } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const revenueDollars = (revenue._sum.amountTotalCents ?? 0) / 100;

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products" value={String(productCount)} />
        <Stat label="Orders" value={String(orderCount)} />
        <Stat label="Revenue" value={formatPrice(revenueDollars)} />
        <Stat label="To ship" value={String(toShip)} />
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
