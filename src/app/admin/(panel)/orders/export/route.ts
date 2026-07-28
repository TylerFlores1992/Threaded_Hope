import { prisma, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * CSV export of all recorded orders for bookkeeping. Gated by the admin
 * middleware (it lives under /admin). Streams a downloadable file.
 */
type Item = { name?: string; size?: string | null; quantity?: number };

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote if it contains comma, quote, or newline; double internal quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const dollars = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2);

export async function GET() {
  if (!isDbConfigured() || !prisma) {
    return new Response("Database not configured.", { status: 503 });
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = [
    "Date",
    "Order",
    "Customer",
    "Email",
    "Items",
    "Item count",
    "Subtotal",
    "Discount",
    "Shipping",
    "Total",
    "Status",
    "Fulfillment",
    "Tracking",
    "Carrier",
    "Gift",
    "Pickup",
  ];

  const rows = orders.map((o) => {
    const items = (Array.isArray(o.items) ? o.items : []) as Item[];
    const itemsText = items
      .map(
        (it) =>
          `${it.name ?? "Item"}${it.size ? ` (${it.size})` : ""} x${it.quantity ?? 1}`,
      )
      .join("; ");
    const count = items.reduce((n, it) => n + (it.quantity ?? 1), 0);
    return [
      o.createdAt.toISOString().slice(0, 10),
      `#${o.id.slice(-8).toUpperCase()}`,
      o.customerName ?? "",
      o.email ?? "",
      itemsText,
      count,
      dollars(o.subtotalCents),
      dollars(o.discountCents),
      dollars(o.shippingCents),
      dollars(o.amountTotalCents),
      o.status,
      o.fulfillmentStatus,
      o.trackingNumber ?? "",
      o.carrier ?? "",
      o.isGift ? "yes" : "",
      o.pickup ? "yes" : "",
    ]
      .map(cell)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="threaded-hope-orders-${today}.csv"`,
    },
  });
}
