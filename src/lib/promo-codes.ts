import "server-only";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Looking up a promo code the shop owner typed on the Record-a-sale page.
 *
 * These are the same Stripe promotion codes the Discounts page manages and
 * customers type at checkout, so a code honoured over the counter is the same
 * code as the one on the website — there is no second list to keep in step.
 *
 * Stripe applies the coupon itself during a real checkout. A recorded sale
 * never touches Stripe, so the discount is worked out here instead and written
 * onto the order as a flat `discountCents`.
 */
export type PromoLookup =
  | { ok: true; code: string; label: string; discountCents: number }
  | { ok: false; error: string };

/**
 * Resolve a code against a subtotal.
 *
 * `subtotalCents` is needed because a percentage coupon has no fixed value —
 * and because an amount-off coupon must never exceed the sale, which would
 * otherwise write a negative total.
 */
export async function lookupPromoCode(
  raw: string,
  subtotalCents: number,
): Promise<PromoLookup> {
  const code = raw.trim();
  if (!code) return { ok: false, error: "Enter a code." };
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe isn't connected, so codes can't be checked." };
  }

  let found;
  try {
    // Stripe matches codes case-insensitively but stores them uppercase.
    const res = await getStripe().promotionCodes.list({
      code: code.toUpperCase(),
      limit: 1,
      expand: ["data.promotion.coupon"],
    });
    found = res.data[0];
  } catch (err) {
    console.error("Promo code lookup failed:", err);
    return { ok: false, error: "Couldn't reach Stripe to check that code." };
  }

  if (!found) return { ok: false, error: "No such code." };
  if (!found.active) return { ok: false, error: "That code is turned off." };
  if (found.expires_at && found.expires_at * 1000 < Date.now()) {
    return { ok: false, error: "That code has expired." };
  }
  if (
    found.max_redemptions != null &&
    found.times_redeemed >= found.max_redemptions
  ) {
    return { ok: false, error: "That code has been fully used." };
  }

  const promotion = found.promotion as { coupon?: unknown } | null;
  const coupon = (promotion?.coupon ?? null) as {
    percent_off?: number | null;
    amount_off?: number | null;
    name?: string | null;
    valid?: boolean;
  } | null;

  if (!coupon || coupon.valid === false) {
    return { ok: false, error: "That code's discount is no longer valid." };
  }

  // A minimum-spend code shouldn't silently apply to a smaller sale.
  const minimum = found.restrictions?.minimum_amount ?? null;
  if (minimum != null && subtotalCents < minimum) {
    return {
      ok: false,
      error: `That code needs a subtotal of at least $${(minimum / 100).toFixed(2)}.`,
    };
  }

  let discountCents = 0;
  let label = coupon.name ?? found.code;
  if (coupon.percent_off != null) {
    discountCents = Math.round((subtotalCents * coupon.percent_off) / 100);
    label = coupon.name ?? `${coupon.percent_off}% off`;
  } else if (coupon.amount_off != null) {
    discountCents = coupon.amount_off;
    label = coupon.name ?? `$${(coupon.amount_off / 100).toFixed(2)} off`;
  }

  // Never let a discount exceed the sale — a negative total is unrecordable.
  discountCents = Math.min(Math.max(0, discountCents), subtotalCents);
  if (discountCents === 0) {
    return { ok: false, error: "That code takes nothing off this sale." };
  }

  return { ok: true, code: found.code, label, discountCents };
}
