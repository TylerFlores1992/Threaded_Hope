import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { createTestOrder } from "./actions";
import { isShippoTestMode } from "@/lib/shipping";
import {
  AdminOrdersTable,
  type AdminOrder,
} from "@/components/admin/AdminOrdersTable";

export const dynamic = "force-dynamic";

type OrderItem = { name: string; quantity: number };

export default async function OrdersPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to see recorded orders. Your paid orders are always
        available in the Stripe Dashboard.
      </p>
    );
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows: AdminOrder[] = orders.map((o) => {
    const items = (Array.isArray(o.items) ? o.items : []) as OrderItem[];
    return {
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customerName,
      email: o.email,
      itemCount: items.reduce((n, it) => n + (it.quantity ?? 1), 0),
      itemNames: items.map((it) => it.name).join(", "),
      amountTotalCents: o.amountTotalCents,
      fulfillmentStatus: o.fulfillmentStatus,
      source: o.source,
      isGift: o.isGift,
      pickup: o.pickup,
      hasLabel: Boolean(o.labelUrl),
      trackingNumber: o.trackingNumber,
    };
  });

  // Headline counts, matching the strip Shopify shows above its order list.
  const itemsOrdered = rows.reduce((n, o) => n + o.itemCount, 0);
  const fulfilled = rows.filter(
    (o) => o.fulfillmentStatus !== "unfulfilled",
  ).length;
  const delivered = rows.filter(
    (o) => o.fulfillmentStatus === "delivered",
  ).length;
  const unfulfilled = rows.length - fulfilled;

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">
        Orders <span className="text-lg text-ink-soft">({orders.length})</span>
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Recorded from Stripe on payment. Full details (receipts, refunds) live
        in your Stripe Dashboard.
      </p>

      <div className="mt-4">
        <Link
          href="/admin/orders/new"
          className="rounded-full bg-sage-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-sage"
        >
          + Record a sale
        </Link>
        <span className="ml-2 text-xs text-ink-soft">
          For orders made outside the website.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <Link
          href="/admin/orders/packaging"
          className="text-sm font-medium text-sage-deep hover:underline"
        >
          Manage packaging →
        </Link>
        {/* Route handler returning a file download — a plain <a> is correct. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/orders/export"
          className="text-sm font-medium text-sage-deep hover:underline"
        >
          Export CSV ↓
        </a>
      </div>

      {isShippoTestMode() && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={createTestOrder.bind(null, false, false)}>
            <button
              type="submit"
              className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:bg-sand"
            >
              + Create sample order (test mode)
            </button>
          </form>
          <form action={createTestOrder.bind(null, true, false)}>
            <button
              type="submit"
              className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:bg-sand"
            >
              + Create sample gift order
            </button>
          </form>
          <form action={createTestOrder.bind(null, false, true)}>
            <button
              type="submit"
              className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:bg-sand"
            >
              + Create sample pickup order
            </button>
          </form>
          <span className="text-xs text-ink-soft">
            Only shown while a Shippo test token is set.
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Orders", value: rows.length },
          { label: "Items ordered", value: itemsOrdered },
          { label: "To fulfill", value: unfulfilled },
          { label: "Delivered", value: delivered },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white/70 p-5 ring-1 ring-border"
          >
            <p className="text-sm text-ink-soft">{s.label}</p>
            <p className="mt-1 font-serif text-2xl text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-lg bg-sand p-4 text-sm text-ink-soft">
          No orders yet. When a customer completes checkout, the order appears
          here.
        </p>
      ) : (
        <div className="mt-6">
          <AdminOrdersTable orders={rows} />
        </div>
      )}
    </div>
  );
}
