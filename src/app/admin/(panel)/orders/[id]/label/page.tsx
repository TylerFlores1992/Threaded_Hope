import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma, isDbConfigured } from "@/lib/db";
import { store } from "@/data/store";
import {
  isShippingConfigured,
  createShipment,
  type ShipToAddress,
  type Rate,
} from "@/lib/shipping";
import { getPackagingOptions } from "@/lib/packaging";
import { ParcelForm } from "@/components/admin/ParcelForm";
import { purchaseLabel } from "../../actions";

export const dynamic = "force-dynamic";

type ShipJson = {
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

export default async function BuyLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isDbConfigured()) notFound();
  const prisma = getPrisma();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  const back = (
    <Link href="/admin/orders" className="text-sm text-ink-soft">
      ← Orders
    </Link>
  );

  // Not configured → show setup instructions instead of the buy UI.
  if (!isShippingConfigured()) {
    return (
      <div className="max-w-xl">
        {back}
        <h1 className="mt-2 mb-4 font-serif text-3xl text-ink">
          Shipping labels
        </h1>
        <div className="space-y-3 rounded-2xl bg-sand p-5 text-sm text-ink-soft">
          <p className="font-medium text-ink">
            Label buying isn’t set up yet.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Create a free account at{" "}
              <span className="font-medium text-ink">goshippo.com</span> (pay
              per label, no monthly fee).
            </li>
            <li>
              Copy your API token (Settings → API) and add it in Vercel as{" "}
              <code className="rounded bg-white px-1">SHIPPO_API_KEY</code>.
            </li>
            <li>
              Set your return address in{" "}
              <code className="rounded bg-white px-1">src/data/store.ts</code>{" "}
              (<span className="font-medium text-ink">shipFrom</span>).
            </li>
          </ol>
          <p>
            Until then you can still print a{" "}
            <Link
              href={`/admin/orders/${id}/slip`}
              className="font-medium text-sage-deep underline"
            >
              packing slip
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // Already purchased → show the label + tracking.
  if (order.labelUrl) {
    return (
      <div className="max-w-xl">
        {back}
        <h1 className="mt-2 mb-4 font-serif text-3xl text-ink">
          Shipping label
        </h1>
        <div className="space-y-3 rounded-2xl bg-white/70 p-5 text-sm ring-1 ring-border">
          <p className="text-ink">
            Label purchased{order.carrier ? ` — ${order.carrier}` : ""}.
          </p>
          {order.trackingNumber && (
            <p className="text-ink-soft">
              Tracking:{" "}
              <span className="font-medium text-ink">
                {order.trackingNumber}
              </span>
            </p>
          )}
          <a
            href={order.labelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-sage-deep px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Open / print label (PDF)
          </a>
        </div>
      </div>
    );
  }

  const ship = (order.shipping ?? null) as ShipJson | null;
  const addr = ship?.address ?? null;
  const to: ShipToAddress = {
    name: ship?.name ?? order.customerName,
    street1: addr?.line1,
    street2: addr?.line2,
    city: addr?.city,
    state: addr?.state,
    zip: addr?.postal_code,
    country: addr?.country ?? "US",
    email: order.email,
  };

  if (!addr) {
    return (
      <div className="max-w-xl">
        {back}
        <h1 className="mt-2 mb-4 font-serif text-3xl text-ink">
          Shipping label
        </h1>
        <p className="rounded-2xl bg-sand p-5 text-sm text-ink-soft">
          This order has no shipping address (local pickup) — no label needed.
        </p>
      </div>
    );
  }

  // Estimate the shipment weight from the ordered products' unit weights plus
  // packaging, so the parcel form is prefilled and you just verify it.
  const orderItems = (Array.isArray(order.items) ? order.items : []) as {
    slug?: string | null;
    quantity?: number;
  }[];
  const slugs = orderItems
    .map((it) => it.slug)
    .filter((s): s is string => Boolean(s));
  const weightBySlug = new Map<string, number>();
  if (slugs.length > 0) {
    const products = await prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, weightOz: true },
    });
    for (const p of products) {
      if (typeof p.weightOz === "number") weightBySlug.set(p.slug, p.weightOz);
    }
  }
  const itemsWeight = orderItems.reduce((sum, it) => {
    const w = it.slug ? (weightBySlug.get(it.slug) ?? 0) : 0;
    return sum + w * (it.quantity ?? 1);
  }, 0);
  const anyWeightKnown = weightBySlug.size > 0;
  const packagingOptions = await getPackagingOptions();

  // Parcel dims come through the query once the parcel form is submitted.
  const num = (v: string | string[] | undefined) =>
    typeof v === "string" ? Number(v) : NaN;
  const length = num(sp.length);
  const width = num(sp.width);
  const height = num(sp.height);
  const weightOz = num(sp.weight);
  const haveParcel =
    [length, width, height, weightOz].every((n) => Number.isFinite(n) && n > 0);

  let rates: Rate[] = [];
  let messages: string[] = [];
  let error: string | null = null;
  if (haveParcel) {
    try {
      const result = await createShipment(to, {
        length,
        width,
        height,
        weightOz,
      });
      rates = result.rates;
      messages = result.messages;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not fetch rates.";
    }
  }

  return (
    <div className="max-w-xl">
      {back}
      <h1 className="mt-2 mb-1 font-serif text-3xl text-ink">
        Buy shipping label
      </h1>
      <p className="mb-5 text-sm text-ink-soft">
        Ship to {to.name} — {addr.city}, {addr.state} {addr.postal_code}
      </p>

      {/* Parcel form (GET → puts dims in the query, page fetches rates) */}
      <ParcelForm
        itemsWeight={itemsWeight}
        anyWeightKnown={anyWeightKnown}
        packagingOptions={packagingOptions}
        initial={{
          length: typeof sp.length === "string" ? sp.length : "",
          width: typeof sp.width === "string" ? sp.width : "",
          height: typeof sp.height === "string" ? sp.height : "",
          weight: typeof sp.weight === "string" ? sp.weight : "",
          packaging: typeof sp.packaging === "string" ? sp.packaging : "",
        }}
      />

      {typeof sp.buyError === "string" && sp.buyError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Couldn’t buy the label: {sp.buyError}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {haveParcel && !error && rates.length === 0 && (
        <p className="mt-4 rounded-lg bg-sand p-3 text-sm text-ink-soft">
          No rates returned.{" "}
          {messages.length > 0 ? messages.join(" ") : "Check the addresses and parcel size."}
        </p>
      )}

      {rates.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-ink">Rates</p>
          <div className="divide-y divide-border rounded-2xl bg-white/70 ring-1 ring-border">
            {rates.map((r) => (
              <div
                key={r.objectId}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-ink">
                    {r.provider} — {r.servicelevel}
                  </p>
                  <p className="text-xs text-ink-soft">
                    ${r.amount} {r.currency}
                    {r.estimatedDays
                      ? ` · ~${r.estimatedDays} day${r.estimatedDays === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <form action={purchaseLabel.bind(null, id, r.objectId)}>
                  <button
                    type="submit"
                    className="rounded-lg bg-sage-deep px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    Buy ${r.amount}
                  </button>
                </form>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Buying charges your {store.shortName} Shippo balance and generates a
            printable PDF label.
          </p>
        </div>
      )}
    </div>
  );
}
