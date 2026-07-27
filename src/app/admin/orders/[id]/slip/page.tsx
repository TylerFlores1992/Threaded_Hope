import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPrisma, isDbConfigured } from "@/lib/db";
import { getHomeImages } from "@/lib/home-images";
import { store } from "@/data/store";
import { formatPrice } from "@/lib/format";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

type SlipItem = {
  name: string;
  size?: string | null;
  quantity?: number;
  unitAmountCents?: number;
};

type ShipAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

type Shipping = { name?: string | null; address?: ShipAddress | null };

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDbConfigured()) notFound();
  const prisma = getPrisma();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  const homeImages = await getHomeImages();
  const logoSrc = homeImages.home_logo ?? "/logo.png";

  const items = (Array.isArray(order.items) ? order.items : []) as SlipItem[];
  const shipping = (order.shipping ?? null) as Shipping | null;
  const addr = shipping?.address ?? null;
  const shipName = shipping?.name ?? order.customerName ?? order.email ?? "—";
  const itemCount = items.reduce((n, it) => n + (it.quantity ?? 1), 0);

  const orderDate = order.createdAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 text-ink print:py-0">
      {/* Screen-only toolbar */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/admin/orders" className="text-sm text-ink-soft">
          ← Orders
        </Link>
        <PrintButton label="Print packing slip" />
      </div>

      <div className="rounded-2xl bg-white p-8 ring-1 ring-border print:rounded-none print:p-0 print:ring-0">
        {/* Header: logo + store contact */}
        <div className="flex items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Image
              src={logoSrc}
              alt={store.name}
              width={56}
              height={56}
              className="h-14 w-auto object-contain"
              unoptimized
            />
            <div>
              <p className="font-serif text-xl text-ink">{store.name}</p>
              <p className="text-xs text-ink-soft">{store.tagline}</p>
            </div>
          </div>
          <div className="text-right text-xs text-ink-soft">
            <p>{store.contact.email}</p>
            {store.contact.phone && <p>{store.contact.phone}</p>}
            {store.socials.instagramHandle && (
              <p>@{store.socials.instagramHandle}</p>
            )}
          </div>
        </div>

        <h1 className="mt-6 font-serif text-2xl text-ink">Packing Slip</h1>

        {/* Order + ship-to */}
        <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Order
            </p>
            <p className="mt-1 text-ink">{orderDate}</p>
            <p className="text-ink-soft">#{order.id.slice(-8).toUpperCase()}</p>
            {order.email && <p className="text-ink-soft">{order.email}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Ship to
            </p>
            <p className="mt-1 text-ink">{shipName}</p>
            {addr ? (
              <div className="text-ink-soft">
                {addr.line1 && <p>{addr.line1}</p>}
                {addr.line2 && <p>{addr.line2}</p>}
                <p>
                  {[addr.city, addr.state, addr.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {addr.country && <p>{addr.country}</p>}
              </div>
            ) : (
              <p className="text-ink-soft">
                No shipping address — local pickup.
              </p>
            )}
          </div>
        </div>

        {/* Items */}
        <table className="mt-6 w-full text-left text-sm">
          <thead className="border-b border-border text-ink-soft">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-center font-medium">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it, i) => (
              <tr key={i}>
                <td className="py-2 text-ink">
                  {it.name}
                  {it.size && (
                    <span className="block text-xs text-ink-soft">
                      Size: {it.size}
                    </span>
                  )}
                </td>
                <td className="py-2 text-center text-ink">
                  {it.quantity ?? 1}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium text-ink">
              <td className="py-2">Total items</td>
              <td className="py-2 text-center">{itemCount}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-sm text-ink-soft">
          Order total:{" "}
          <span className="font-medium text-ink">
            {formatPrice(order.amountTotalCents / 100)}
          </span>
        </p>

        {/* Thank-you note */}
        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-ink-soft">
          <p className="font-serif text-base text-ink">
            Thank you for supporting handmade!
          </p>
          <p className="mt-1">
            Questions about your order? Email us at {store.contact.email}.
          </p>
          <p className="mt-3 text-xs">{store.scripture.text}</p>
          <p className="text-xs">{store.scripture.reference}</p>
        </div>
      </div>
    </div>
  );
}
