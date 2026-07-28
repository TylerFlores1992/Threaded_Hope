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

  // Gift and local-pickup orders hide every price (the slip goes to the
  // customer). Otherwise the slip shows a full receipt breakdown.
  const isGift = order.isGift;
  const isPickup = order.pickup;
  const showPrices = !isGift && !isPickup;
  const cents = (n: number) => formatPrice(n / 100);

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
              <p className="flex items-center justify-end gap-1">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                @{store.socials.instagramHandle}
              </p>
            )}
          </div>
        </div>

        <h1 className="mt-6 font-serif text-2xl text-ink">
          {isGift ? "Gift Receipt" : isPickup ? "Pickup Slip" : "Packing Slip"}
        </h1>

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
              {isPickup ? "Pickup" : "Ship to"}
            </p>
            <p className="mt-1 text-ink">{shipName}</p>
            {isPickup ? (
              <p className="text-ink-soft">Local pickup — no shipping.</p>
            ) : addr ? (
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
              {showPrices && (
                <>
                  <th className="py-2 text-right font-medium">Price</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </>
              )}
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
                  {showPrices && (
                    <>
                      <td className="py-2 text-right text-ink-soft">
                        {cents(unit)}
                      </td>
                      <td className="py-2 text-right text-ink">
                        {cents(unit * qty)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium text-ink">
              <td className="py-2">Total items</td>
              <td className="py-2 text-center">{itemCount}</td>
              {showPrices && <td colSpan={2} />}
            </tr>
          </tfoot>
        </table>

        {showPrices ? (
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            {order.subtotalCents != null && (
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{cents(order.subtotalCents)}</span>
              </div>
            )}
            {order.discountCents != null && order.discountCents > 0 && (
              <div className="flex justify-between text-ink-soft">
                <span>Discount</span>
                <span>−{cents(order.discountCents)}</span>
              </div>
            )}
            {order.shippingCents != null && (
              <div className="flex justify-between text-ink-soft">
                <span>Shipping</span>
                <span>
                  {order.shippingCents === 0 ? "Free" : cents(order.shippingCents)}
                </span>
              </div>
            )}
            {order.taxCents != null && order.taxCents > 0 && (
              <div className="flex justify-between text-ink-soft">
                <span>Tax</span>
                <span>{cents(order.taxCents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 font-semibold text-ink">
              <span>Total</span>
              <span>{cents(order.amountTotalCents)}</span>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">
            {isGift
              ? "🎁 Gift order — prices are intentionally left off this slip."
              : "🏠 Local pickup — prices are intentionally left off this slip."}
          </p>
        )}

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

      {/* Gift message — its own page (prints on a fresh sheet to tuck in). */}
      {isGift && order.giftMessage && (
        <div
          style={{ breakBefore: "page" }}
          className="mt-10 print:mt-0"
        >
          <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl bg-cream p-10 text-center ring-1 ring-border print:ring-0">
            {/* decorative corners */}
            <div className="pointer-events-none absolute inset-3 rounded-2xl border border-dashed border-sage-deep/40" />
            <p className="relative text-3xl">🎁</p>
            <p className="relative mt-3 font-serif text-2xl text-sage-deep">
              A little gift for you
            </p>
            <p className="relative mx-auto mt-6 max-w-sm whitespace-pre-wrap font-serif text-lg italic leading-relaxed text-ink">
              “{order.giftMessage}”
            </p>
            <div className="relative mt-8 flex items-center justify-center gap-2 text-sm text-ink-soft">
              <span className="h-px w-8 bg-border" />
              <span>with love, {store.name}</span>
              <span className="h-px w-8 bg-border" />
            </div>
            <p className="relative mt-4 text-xs text-ink-soft">
              {store.scripture.text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
