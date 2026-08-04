import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/customers";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const customer = await getCustomer(decodeURIComponent(email));
  if (!customer) notFound();

  const avgCents =
    customer.orderCount > 0 ? customer.totalSpentCents / customer.orderCount : 0;

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-ink-soft">
        ← Customers
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">
        {customer.name ?? customer.email}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        <a href={`mailto:${customer.email}`} className="text-sage-deep hover:underline">
          {customer.email}
        </a>
        {customer.location && <> · {customer.location}</>}
        {customer.subscribed && <> · Subscribed to email</>}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(customer.orderCount)} />
        <Stat
          label="Total spent"
          value={formatPrice(customer.totalSpentCents / 100)}
        />
        <Stat label="Average order" value={formatPrice(avgCents / 100)} />
        <Stat
          label="Customer since"
          value={customer.firstOrderAt ? shortDate(customer.firstOrderAt) : "—"}
        />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold text-ink">Order history</h2>
        {customer.orders.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            Subscribed to the newsletter but hasn&apos;t ordered yet.
          </p>
        ) : (
          <div className="overflow-x-auto admin-card">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-border text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Fulfillment</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customer.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-ink-soft">
                      {shortDate(o.createdAt)}
                      {o.source === "manual" && (
                        <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[10px] font-medium">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 capitalize text-ink-soft">
                      {o.fulfillmentStatus}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-sage-deep">
                      {formatPrice(o.amountTotalCents / 100)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-sage-deep hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
