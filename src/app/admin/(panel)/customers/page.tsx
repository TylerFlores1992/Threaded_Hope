import { isDbConfigured } from "@/lib/db";
import { getCustomers } from "@/lib/customers";
import { formatPrice } from "@/lib/format";
import {
  AdminCustomersTable,
  type AdminCustomer,
} from "@/components/admin/AdminCustomersTable";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export default async function CustomersPage() {
  if (!isDbConfigured()) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to see customers.
      </p>
    );
  }

  const customers = await getCustomers();
  const buyers = customers.filter((c) => c.orderCount > 0);
  const repeat = customers.filter((c) => c.orderCount > 1).length;
  const subscribed = customers.filter((c) => c.subscribed).length;
  const totalCents = buyers.reduce((n, c) => n + c.totalSpentCents, 0);
  const avgCents = buyers.length > 0 ? totalCents / buyers.length : 0;

  const rows: AdminCustomer[] = customers.map((c) => ({
    email: c.email,
    name: c.name,
    location: c.location,
    orderCount: c.orderCount,
    totalSpentCents: c.totalSpentCents,
    lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
    subscribed: c.subscribed,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">
          Customers{" "}
          <span className="text-lg text-ink-soft">({customers.length})</span>
        </h1>
        {/* Route handler returning a file download — a plain <a> is correct. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/customers/export"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-sand"
        >
          Export CSV ↓
        </a>
      </div>
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-soft">
        Built from your orders and newsletter signups — there are no accounts to
        manage. Someone who has ordered more than once is a repeat customer.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers" value={String(buyers.length)} />
        <Stat label="Repeat customers" value={String(repeat)} />
        <Stat label="Subscribed" value={String(subscribed)} />
        <Stat label="Average spend" value={formatPrice(avgCents / 100)} />
      </div>

      <AdminCustomersTable customers={rows} />
    </div>
  );
}
