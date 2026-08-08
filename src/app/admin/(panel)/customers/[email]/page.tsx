import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/customers";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-[12px] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-[19px] font-semibold text-ink">{value}</p>
    </div>
  );
}

/** One labelled fact. Everything here used to run together in a single line. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-24 shrink-0 text-[12px] text-ink-soft">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] text-ink">{children}</dd>
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
  const addr = customer.address;
  const cityLine = addr
    ? [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")
    : "";

  return (
    <div className="max-w-4xl">
      <Link href="/admin/customers" className="text-sm text-ink-soft">
        ← Customers
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-ink">
          {customer.name ?? customer.email}
        </h1>
        {customer.subscribed && (
          <span className="rounded-lg bg-[#cdfee1] px-2 py-0.5 text-[12px] font-medium text-[#0c5132]">
            Subscribed
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(customer.orderCount)} />
        <Stat
          label="Total spent"
          value={formatPrice(customer.totalSpentCents / 100)}
        />
        <Stat label="Average order" value={formatPrice(avgCents / 100)} />
        <Stat
          label="Last order"
          value={customer.lastOrderAt ? shortDate(customer.lastOrderAt) : "—"}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="admin-card p-4">
          <h2 className="mb-1 text-[13px] font-semibold text-ink">Contact</h2>
          <dl className="divide-y divide-border">
            <Row label="Email">
              <a
                href={`mailto:${customer.email}`}
                className="break-all text-sage-deep hover:underline"
              >
                {customer.email}
              </a>
            </Row>
            <Row label="Phone">
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone}`}
                  className="text-sage-deep hover:underline"
                >
                  {customer.phone}
                </a>
              ) : (
                <span className="text-ink-soft">Not given</span>
              )}
            </Row>
            <Row label="Location">
              {customer.location ?? <span className="text-ink-soft">—</span>}
            </Row>
            <Row label="First order">
              {customer.firstOrderAt ? (
                shortDate(customer.firstOrderAt)
              ) : (
                <span className="text-ink-soft">No orders yet</span>
              )}
            </Row>
          </dl>
        </section>

        <section className="admin-card p-4">
          <h2 className="mb-1 text-[13px] font-semibold text-ink">
            Shipping address
          </h2>
          {addr ? (
            <>
              <address className="mt-2 text-[13px] not-italic text-ink">
                {customer.name && <div>{customer.name}</div>}
                {addr.line1 && <div>{addr.line1}</div>}
                {addr.line2 && <div>{addr.line2}</div>}
                {cityLine && <div>{cityLine}</div>}
                {addr.country && <div>{addr.country}</div>}
              </address>
              <p className="mt-3 text-[11px] text-ink-soft">
                From their most recent order — it isn&apos;t kept in sync if they
                move.
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink-soft">
              No address on file. Local-pickup orders and newsletter signups
              don&apos;t have one.
            </p>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold text-ink">
          Order history{" "}
          <span className="font-normal text-ink-soft">
            ({customer.orders.length})
          </span>
        </h2>
        {customer.orders.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
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
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                      {shortDate(o.createdAt)}
                      {o.source !== "web" && (
                        <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[10px] font-medium capitalize">
                          {o.source}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                      {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 capitalize text-ink-soft">
                      {o.fulfillmentStatus}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">
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
