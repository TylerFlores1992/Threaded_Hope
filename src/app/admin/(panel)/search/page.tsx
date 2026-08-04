import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getCustomers } from "@/lib/customers";
import { placeholderImage } from "@/lib/placeholder";

export const dynamic = "force-dynamic";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-[13px] font-semibold text-ink">
        {title} <span className="font-normal text-ink-soft">({count})</span>
      </h2>
      <div className="admin-card divide-y divide-border">{children}</div>
    </section>
  );
}

const row = "flex items-center gap-3 px-4 py-2.5 text-[13px]";

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
        Connect a database to search.
      </p>
    );
  }
  if (!query) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-ink">Search</h1>
        <p className="mt-2 text-[13px] text-ink-soft">
          Type in the bar above to search products, orders, customers and
          collections.
        </p>
      </div>
    );
  }

  const like = { contains: query, mode: "insensitive" as const };
  const [products, collections, orders, allCustomers] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [{ name: like }, { vendor: like }, { productType: like }],
      },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.collection.findMany({
      where: { OR: [{ name: like }, { slug: like }] },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        OR: [{ customerName: like }, { email: like }, { trackingNumber: like }],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    getCustomers(),
  ]);

  const lower = query.toLowerCase();
  const customers = allCustomers
    .filter(
      (c) =>
        c.email.includes(lower) || (c.name ?? "").toLowerCase().includes(lower),
    )
    .slice(0, 10);

  const total =
    products.length + collections.length + orders.length + customers.length;

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">
        Results for “{query}”
      </h1>
      <p className="mt-1 text-[13px] text-ink-soft">
        {total} match{total === 1 ? "" : "es"} across the admin.
      </p>

      <Section title="Products" count={products.length}>
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/admin/products/${p.id}/edit`}
            className={`${row} hover:bg-black/[0.03]`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image || placeholderImage(p.name, 145)}
              alt=""
              className="h-8 w-8 rounded object-cover ring-1 ring-border"
            />
            <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
            <span className="text-ink-soft capitalize">{p.status}</span>
            <span className="font-medium text-ink">
              {formatPrice(p.priceCents / 100)}
            </span>
          </Link>
        ))}
      </Section>

      <Section title="Orders" count={orders.length}>
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/admin/orders/${o.id}`}
            className={`${row} hover:bg-black/[0.03]`}
          >
            <span className="font-mono text-xs text-[#005bd3]">
              #{o.id.slice(-8).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">
              {o.customerName ?? o.email ?? "—"}
            </span>
            <span className="capitalize text-ink-soft">
              {o.fulfillmentStatus}
            </span>
            <span className="font-medium text-ink">
              {formatPrice(o.amountTotalCents / 100)}
            </span>
          </Link>
        ))}
      </Section>

      <Section title="Customers" count={customers.length}>
        {customers.map((c) => (
          <Link
            key={c.email}
            href={`/admin/customers/${encodeURIComponent(c.email)}`}
            className={`${row} hover:bg-black/[0.03]`}
          >
            <span className="min-w-0 flex-1 truncate text-ink">
              {c.name ?? c.email}
            </span>
            <span className="text-ink-soft">
              {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
            </span>
            <span className="font-medium text-ink">
              {formatPrice(c.totalSpentCents / 100)}
            </span>
          </Link>
        ))}
      </Section>

      <Section title="Collections" count={collections.length}>
        {collections.map((c) => (
          <Link
            key={c.id}
            href={`/admin/collections/${c.id}/edit`}
            className={`${row} hover:bg-black/[0.03]`}
          >
            <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
            <span className="text-ink-soft">{c.slug}</span>
          </Link>
        ))}
      </Section>

      {total === 0 && (
        <p className="mt-4 rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
          Nothing matched “{query}”.
        </p>
      )}
    </div>
  );
}
