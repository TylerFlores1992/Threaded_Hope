import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { DiscountForm } from "@/components/admin/DiscountForm";

export const dynamic = "force-dynamic";

async function listCodes(): Promise<Stripe.PromotionCode[]> {
  const stripe = getStripe();
  const res = await stripe.promotionCodes.list({
    limit: 50,
    expand: ["data.promotion.coupon"],
  });
  return res.data;
}

export default async function DiscountsPage() {
  if (!isStripeConfigured()) {
    return (
      <div>
        <h1 className="font-serif text-3xl text-ink">Discounts</h1>
        <p className="mt-4 rounded-lg bg-sand p-4 text-sm text-ink-soft">
          Add your Stripe keys to create and manage promo codes.
        </p>
      </div>
    );
  }

  let codes: Stripe.PromotionCode[] = [];
  let error: string | null = null;
  try {
    codes = await listCodes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load discounts.";
  }

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Discounts</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Promo codes are powered by Stripe and can be entered by customers at
        checkout.
      </p>

      <section className="mt-6 rounded-2xl bg-white/70 p-5 ring-1 ring-border">
        <h2 className="mb-4 font-serif text-xl text-ink">New discount</h2>
        <DiscountForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl text-ink">Existing codes</h2>
        {error ? (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : codes.length === 0 ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            No discount codes yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white/70 ring-1 ring-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Discount</th>
                  <th className="px-4 py-3 font-medium">Redeemed</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codes.map((c) => {
                  const coupon = c.promotion.coupon as Stripe.Coupon | null;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-mono text-ink">{c.code}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {coupon?.percent_off
                          ? `${coupon.percent_off}% off`
                          : coupon?.amount_off
                            ? `$${(coupon.amount_off / 100).toFixed(2)} off`
                            : "—"}
                        {coupon && (
                          <span className="ml-1 text-xs">
                            ({coupon.duration})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {c.times_redeemed}
                      </td>
                      <td className="px-4 py-3">
                        {c.active ? (
                          <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-sage-deep">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
