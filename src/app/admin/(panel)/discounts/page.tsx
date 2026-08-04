import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { isDbConfigured } from "@/lib/db";
import { getAllDiscountRules, type DiscountRule } from "@/lib/discounts";
import { formatPrice } from "@/lib/format";
import { DiscountForm } from "@/components/admin/DiscountForm";
import { AutoDiscountForm } from "@/components/admin/AutoDiscountForm";
import { AutoDiscountRow } from "@/components/admin/AutoDiscountRow";

export const dynamic = "force-dynamic";

async function listCodes(): Promise<Stripe.PromotionCode[]> {
  const stripe = getStripe();
  const res = await stripe.promotionCodes.list({
    limit: 50,
    expand: ["data.promotion.coupon"],
  });
  return res.data;
}

function ruleSummary(r: DiscountRule): string {
  const when =
    r.kind === "spend"
      ? `subtotal ≥ ${formatPrice(r.threshold / 100)}`
      : `${r.threshold}+ items`;
  const off =
    r.percentOff != null
      ? `${r.percentOff}% off`
      : `${formatPrice((r.amountOffCents ?? 0) / 100)} off`;
  return `${when} → ${off}`;
}

export default async function DiscountsPage() {
  const rules = await getAllDiscountRules();

  let codes: Stripe.PromotionCode[] = [];
  let codesError: string | null = null;
  if (isStripeConfigured()) {
    try {
      codes = await listCodes();
    } catch (err) {
      codesError = err instanceof Error ? err.message : "Could not load codes.";
    }
  }

  // Summary strip, matching the counts Shopify puts above its discount list.
  const activeRules = rules.filter((r) => r.active).length;
  const activeCodes = codes.filter((c) => c.active).length;
  const redemptions = codes.reduce((n, c) => n + c.times_redeemed, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Discounts</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="admin-card p-4">
          <p className="text-sm text-ink-soft">Active automatic discounts</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{activeRules}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-ink-soft">Active promo codes</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{activeCodes}</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-sm text-ink-soft">Code redemptions</p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{redemptions}</p>
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Automatic discounts apply at checkout based on the cart — no code needed.
        Promo codes are typed in by customers. Stripe applies one discount per
        order, so an automatic discount takes the place of a typed code when both
        would apply.
      </p>

      {/* ── Automatic discounts ── */}
      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">Automatic discounts</h2>
        {!isDbConfigured() ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            Connect a database to create automatic discount rules.
          </p>
        ) : (
          <>
            <div className="admin-card p-4">
              <h3 className="mb-4 text-[13px] font-semibold text-ink">New rule</h3>
              <AutoDiscountForm />
            </div>
            <div className="mt-4">
              {rules.length === 0 ? (
                <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
                  No automatic rules yet. e.g. “3+ items → 10% off”.
                </p>
              ) : (
                <div className="overflow-x-auto admin-card">
                  <table className="w-full text-left text-[13px]">
                    <thead className="border-b border-border text-ink-soft">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Rule</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rules.map((r) => (
                        <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                          <td className="px-4 py-3 text-ink">{r.label}</td>
                          <td className="px-4 py-3 text-ink-soft">{ruleSummary(r)}</td>
                          <td className="px-4 py-3">
                            {r.active ? (
                              <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-sage-deep">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                Paused
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <AutoDiscountRow id={r.id} active={r.active} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Manual promo codes (Stripe) ── */}
      <section className="mt-10">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">Promo codes</h2>
        {!isStripeConfigured() ? (
          <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
            Add your Stripe keys to create and manage promo codes.
          </p>
        ) : (
          <>
            <div className="admin-card p-4">
              <h3 className="mb-4 text-[13px] font-semibold text-ink">New code</h3>
              <DiscountForm />
            </div>
            <div className="mt-4">
              {codesError ? (
                <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {codesError}
                </p>
              ) : codes.length === 0 ? (
                <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
                  No promo codes yet.
                </p>
              ) : (
                <div className="overflow-x-auto admin-card">
                  <table className="w-full text-left text-[13px]">
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
                                  ? `${formatPrice(coupon.amount_off / 100)} off`
                                  : "—"}
                              {coupon && (
                                <span className="ml-1 text-xs">({coupon.duration})</span>
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
            </div>
          </>
        )}
      </section>
    </div>
  );
}
