import { prisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";

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
    take: 100,
  });

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">
        Orders <span className="text-lg text-ink-soft">({orders.length})</span>
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Recorded from Stripe on payment. Full details (receipts, refunds) live
        in your Stripe Dashboard.
      </p>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-lg bg-sand p-4 text-sm text-ink-soft">
          No orders yet. When a customer completes checkout, the order appears
          here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => {
                const items = (
                  Array.isArray(o.items) ? o.items : []
                ) as OrderItem[];
                const count = items.reduce(
                  (n, it) => n + (it.quantity ?? 1),
                  0,
                );
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-ink-soft">
                      {o.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {o.customerName ?? o.email ?? "—"}
                      {o.customerName && o.email && (
                        <span className="block text-xs text-ink-soft">
                          {o.email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {count} item{count === 1 ? "" : "s"}
                      <span className="block max-w-xs truncate text-xs">
                        {items.map((it) => it.name).join(", ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-sage-deep">
                      {formatPrice(o.amountTotalCents / 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
