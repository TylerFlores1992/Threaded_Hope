/**
 * Automatic discount rules — the shape and the arithmetic, with no database
 * behind it. A plain module (no `server-only`) so the Record-a-sale form can
 * show the shop owner what a rule takes off *before* she saves, while reading
 * the rules themselves stays server-side in `lib/discounts.ts`.
 *
 * The split matters: a `server-only` import from a client component is a build
 * error, and the alternative — leaving the client to guess, or not showing the
 * discount at all — is what made an automatic discount invisible on a
 * hand-recorded sale in the first place. Same pattern as
 * `lib/gifting-rows.ts` beside `lib/gifting.ts`.
 *
 * Whichever side runs it, the server recomputes on submit and that figure is
 * what gets written: this is a preview, never the authority.
 */

export type DiscountRule = {
  id: string;
  label: string;
  kind: "quantity" | "spend";
  threshold: number; // min item count (quantity) or min subtotal in cents (spend)
  percentOff: number | null;
  amountOffCents: number | null;
  active: boolean;
};

/**
 * What a cart has to look like for a rule to fire.
 *
 * `totalQty` is the sum of the line quantities, not the number of lines — three
 * of one thing is a three-item order, the same as one each of three things.
 * Both the website checkout and Record a sale count it that way.
 */
export type DiscountCart = { totalQty: number; subtotalCents: number };

/** The dollar value a rule takes off a given cart (0 if it doesn't apply). */
export function ruleDiscountCents(rule: DiscountRule, cart: DiscountCart): number {
  const meets =
    rule.kind === "quantity"
      ? cart.totalQty >= rule.threshold
      : cart.subtotalCents >= rule.threshold;
  if (!meets) return 0;
  if (rule.percentOff != null) {
    return Math.round((cart.subtotalCents * rule.percentOff) / 100);
  }
  if (rule.amountOffCents != null) {
    return Math.min(rule.amountOffCents, cart.subtotalCents);
  }
  return 0;
}

/** The best-matching active rule for a cart, or null. */
export function pickBestRule(
  rules: DiscountRule[],
  cart: DiscountCart,
): DiscountRule | null {
  let best: DiscountRule | null = null;
  let bestValue = 0;
  for (const rule of rules) {
    const value = ruleDiscountCents(rule, cart);
    if (value > bestValue) {
      best = rule;
      bestValue = value;
    }
  }
  return best;
}
