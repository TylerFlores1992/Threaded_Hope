import type { Metadata } from "next";
import { store } from "@/data/store";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "Shipping timelines, rates, and our return policy.",
};

export default function ShippingReturnsPage() {
  return (
    <div>
      <PageIntro
        title="Shipping & Returns"
        subtitle="Simple, friendly policies — because shopping handmade should feel easy."
      />
      <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-ink-soft">
        <section>
          <h2 className="font-serif text-2xl text-ink">Shipping</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Flat-rate shipping of{" "}
              <strong>${store.shipping.flatRate.toFixed(2)}</strong> on all US orders.
            </li>
            <li>
              <strong>Free shipping</strong> on orders over $
              {store.shipping.freeThreshold}.
            </li>
            <li>In-stock items ship within 2–4 business days.</li>
            <li>Made-to-order pieces may take 1–2 weeks; we&apos;ll keep you posted.</li>
            <li>You&apos;ll receive tracking by email as soon as your order ships.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-ink">Returns & Exchanges</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Unused items may be returned within 30 days of delivery.</li>
            <li>
              To start a return, email{" "}
              <a
                href={`mailto:${store.contact.email}`}
                className="text-sage-deep hover:underline"
              >
                {store.contact.email}
              </a>{" "}
              with your order number.
            </li>
            <li>Refunds are issued to the original payment method once received.</li>
            <li>
              For hygiene reasons, boo-boo bags and other rice-filled items are final
              sale unless they arrive damaged.
            </li>
            <li>
              Custom and personalized orders are non-refundable, but we&apos;ll always
              make it right if something isn&apos;t as described.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-ink">Damaged in transit?</h2>
          <p className="mt-3">
            We&apos;re so sorry! Send us a photo within 7 days of delivery and we&apos;ll
            arrange a replacement or refund right away.
          </p>
        </section>
      </article>
    </div>
  );
}
