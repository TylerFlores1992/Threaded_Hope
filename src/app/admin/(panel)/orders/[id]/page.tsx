import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { FulfillmentControl } from "@/components/admin/FulfillmentControl";
import { RefundPanel } from "@/components/admin/RefundPanel";
import { isFullyRefunded, isStripeBackedOrder } from "@/lib/order-refunds";

export const dynamic = "force-dynamic";

type Item = {
  name?: string;
  size?: string | null;
  quantity?: number;
  unitAmountCents?: number;
};
type Shipping = {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDbConfigured()) notFound();
  const order = await getPrisma().order.findUnique({ where: { id } });
  if (!order) notFound();

  const items = (Array.isArray(order.items) ? order.items : []) as Item[];
  const ship = (order.shipping ?? null) as Shipping | null;
  const addr = ship?.address ?? null;
  const cents = (n: number) => formatPrice(n / 100);
  const date = order.createdAt.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const totalLine = (label: string, value: string, strong = false) => (
    <div
      className={`flex justify-between ${strong ? "border-t border-border pt-1 font-semibold text-ink" : "text-ink-soft"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <Link href="/admin/orders" className="text-sm text-ink-soft">
        ← Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            Order #{order.id.slice(-8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{date}</p>
        </div>
        <FulfillmentControl
          orderId={order.id}
          status={order.fulfillmentStatus}
          refunded={isFullyRefunded(order)}
        />
      </div>

      {/* Flags */}
      {(order.isGift || order.pickup || order.refundedCents > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {order.refundedCents > 0 && (
            <span className="rounded-full bg-[#e3e3e3] px-2 py-0.5 text-[#4a4a4a]">
              {order.refundedCents >= order.amountTotalCents
                ? "Refunded"
                : "Partially refunded"}{" "}
              · {cents(order.refundedCents)}
            </span>
          )}
          {order.isGift && (
            <span className="rounded-full bg-sand px-2 py-0.5 text-ink-soft">
              🎁 Gift
            </span>
          )}
          {order.pickup && (
            <span className="rounded-full bg-sand px-2 py-0.5 text-ink-soft">
              🏠 Local pickup
            </span>
          )}
        </div>
      )}

      {order.source === "manual" && (
        <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">
          Recorded manually (sale made outside the website).
          {order.notes ? ` Note: ${order.notes}` : ""}
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/admin/orders/${order.id}/slip`}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
        >
          {order.isGift || order.pickup ? "Print slip (no prices)" : "Print packing slip"}
        </Link>
        <Link
          href={`/admin/orders/${order.id}/label`}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
        >
          {order.labelUrl ? "View label" : "Buy shipping label"}
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Customer */}
        <div className="admin-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Customer
          </h2>
          <p className="mt-2 text-ink">{order.customerName ?? "—"}</p>
          {order.email && <p className="text-sm text-ink-soft">{order.email}</p>}
        </div>

        {/* Shipping */}
        <div className="admin-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            {order.pickup ? "Pickup" : "Ship to"}
          </h2>
          {order.pickup ? (
            <p className="mt-2 text-sm text-ink-soft">Local pickup — no shipping.</p>
          ) : addr ? (
            <div className="mt-2 text-sm text-ink-soft">
              <p className="text-ink">{ship?.name ?? order.customerName}</p>
              {addr.line1 && <p>{addr.line1}</p>}
              {addr.line2 && <p>{addr.line2}</p>}
              <p>
                {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}
              </p>
              {addr.country && <p>{addr.country}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">No shipping address.</p>
          )}
          {order.trackingNumber && (
            <p className="mt-2 text-xs text-ink-soft">
              {order.carrier ? `${order.carrier} · ` : ""}Tracking:{" "}
              <span className="font-medium text-ink">{order.trackingNumber}</span>
            </p>
          )}
        </div>
      </div>

      {/* Gift message */}
      {order.isGift && (order.giftMessage || order.giftFrom) && (
        <div className="mt-4 rounded-2xl bg-sand p-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Gift message
          </h2>
          {order.giftMessage && (
            <p className="mt-2 whitespace-pre-wrap font-serif italic text-ink">
              “{order.giftMessage}”
            </p>
          )}
          {order.giftFrom && (
            <p className="mt-2 font-serif text-ink">— from {order.giftFrom}</p>
          )}
        </div>
      )}

      {/* Items + totals */}
      <div className="mt-4 admin-card p-4">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-center font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it, i) => {
              const qty = it.quantity ?? 1;
              const unit = it.unitAmountCents ?? 0;
              return (
                <tr key={i}>
                  <td className="py-2 text-ink">
                    {it.name}
                    {it.size && (
                      <span className="block text-xs text-ink-soft">
                        Size: {it.size}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center text-ink">{qty}</td>
                  <td className="py-2 text-right text-ink-soft">{cents(unit)}</td>
                  <td className="py-2 text-right text-ink">{cents(unit * qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          {order.subtotalCents != null &&
            totalLine("Subtotal", cents(order.subtotalCents))}
          {order.discountCents != null &&
            order.discountCents > 0 &&
            totalLine("Discount", `−${cents(order.discountCents)}`)}
          {order.shippingCents != null &&
            totalLine(
              "Shipping",
              order.shippingCents === 0 ? "Free" : cents(order.shippingCents),
            )}
          {order.taxCents != null && order.taxCents > 0 &&
            totalLine("Tax", cents(order.taxCents))}
          {totalLine("Total", cents(order.amountTotalCents), true)}
          {order.refundedCents > 0 && (
            <>
              {totalLine("Refunded", `−${cents(order.refundedCents)}`)}
              {totalLine(
                "Net",
                cents(order.amountTotalCents - order.refundedCents),
                true,
              )}
            </>
          )}
        </div>

        <RefundPanel
          orderId={order.id}
          totalCents={order.amountTotalCents}
          refundedCents={order.refundedCents}
          stripeBacked={isStripeBackedOrder(order)}
          alreadyRestocked={Boolean(order.restockedAt)}
        />
        {order.refundReason && (
          <p className="mt-2 text-xs text-ink-soft">
            Refund reason: {order.refundReason}
          </p>
        )}
      </div>
    </div>
  );
}
