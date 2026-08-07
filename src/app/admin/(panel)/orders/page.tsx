import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { createTestOrder } from "./actions";
import { isShippoTestMode } from "@/lib/shipping";
import { StatStrip } from "@/components/admin/StatStrip";
import { RemoveSampleOrders } from "@/components/admin/RemoveSampleOrders";
import {
  AdminOrdersTable,
  type AdminOrder,
} from "@/components/admin/AdminOrdersTable";

export const dynamic = "force-dynamic";

type OrderItem = { name: string; quantity: number };

export default async function OrdersPage() {
  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
        Connect a database to see recorded orders. Your paid orders are always
        available in the Stripe Dashboard.
      </p>
    );
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
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
      refundedCents: o.refundedCents,
      status: o.status,
      fulfillmentStatus: o.fulfillmentStatus,
      source: o.source,
      isGift: o.isGift,
      pickup: o.pickup,
      hasLabel: Boolean(o.labelUrl),
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
    };
  });

  // Placeholder orders from Shippo test mode, identifiable by their session id.
  const sampleCount = orders.filter((o) =>
    o.stripeSessionId.startsWith("test_"),
  ).length;

  const itemsOrdered = rows.reduce((n, o) => n + o.itemCount, 0);
  const fulfilled = rows.filter(
    (o) => o.fulfillmentStatus !== "unfulfilled",
  ).length;
  const delivered = rows.filter(
    (o) => o.fulfillmentStatus === "delivered",
  ).length;
  const unfulfilled = rows.length - fulfilled;

  /**
   * Average time from order to shipment — Shopify's "order to fulfillment
   * time". Only orders we actually shipped have a `shippedAt` to measure.
   */
  const shipped = orders.filter((o) => o.shippedAt);
  const avgHours =
    shipped.length > 0
      ? shipped.reduce(
          (n, o) =>
            n + (o.shippedAt!.getTime() - o.createdAt.getTime()) / 3_600_000,
          0,
        ) / shipped.length
      : null;
  const fulfillmentTime =
    avgHours == null
      ? "—"
      : avgHours < 24
        ? `${avgHours.toFixed(1)} hrs`
        : `${(avgHours / 24).toFixed(1)} days`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/orders/import"
            className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03]"
          >
            Import from Shopify
          </Link>
          <Link
            href="/admin/orders/packaging"
            className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03]"
          >
            Packaging
          </Link>
          {/* Route handler returning a file download — a plain <a> is correct. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/admin/orders/export"
            className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-black/[0.03]"
          >
            Export
          </a>
          <Link
            href="/admin/orders/new"
            className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a]"
          >
            Create order
          </Link>
        </div>
      </div>

      <StatStrip
        period="All time"
        stats={[
          { label: "Orders", value: String(rows.length) },
          { label: "Items ordered", value: String(itemsOrdered) },
          { label: "To fulfill", value: String(unfulfilled) },
          { label: "Delivered", value: String(delivered) },
          { label: "Order to fulfillment", value: fulfillmentTime },
        ]}
      />

      {sampleCount > 0 && <RemoveSampleOrders count={sampleCount} />}

      {isShippoTestMode() && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            { label: "Sample order", gift: false, pickup: false },
            { label: "Sample gift order", gift: true, pickup: false },
            { label: "Sample pickup order", gift: false, pickup: true },
          ].map((s) => (
            <form
              key={s.label}
              action={createTestOrder.bind(null, s.gift, s.pickup)}
            >
              <button
                type="submit"
                className="rounded-lg border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:bg-sand"
              >
                + {s.label}
              </button>
            </form>
          ))}
          <span className="text-[11px] text-ink-soft">
            Only shown while a Shippo test token is set.
          </span>
        </div>
      )}

      {orders.length === 0 ? (
        <p className="mt-4 rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
          No orders yet. When a customer completes checkout, the order appears
          here.
        </p>
      ) : (
        <div className="mt-4">
          <AdminOrdersTable orders={rows} />
        </div>
      )}
    </div>
  );
}
