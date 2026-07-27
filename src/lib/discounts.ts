import "server-only";
import { prisma } from "@/lib/db";

/**
 * Automatic discount rules — applied at checkout with no promo code, based on
 * the cart. Manual promo codes stay separate (Stripe promotion codes managed on
 * the Discounts page). Stripe allows only one discount per Checkout Session, so
 * an auto rule and a typed code can't both apply to the same order.
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

export async function getActiveDiscountRules(): Promise<DiscountRule[]> {
  if (!prisma) return [];
  const rows = await prisma.discountRule.findMany({
    where: { active: true },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind === "spend" ? "spend" : "quantity",
    threshold: r.threshold,
    percentOff: r.percentOff,
    amountOffCents: r.amountOffCents,
    active: r.active,
  }));
}

export async function getAllDiscountRules(): Promise<DiscountRule[]> {
  if (!prisma) return [];
  const rows = await prisma.discountRule.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind === "spend" ? "spend" : "quantity",
    threshold: r.threshold,
    percentOff: r.percentOff,
    amountOffCents: r.amountOffCents,
    active: r.active,
  }));
}

/** The dollar value a rule takes off a given cart (0 if it doesn't apply). */
export function ruleDiscountCents(
  rule: DiscountRule,
  cart: { totalQty: number; subtotalCents: number },
): number {
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
  cart: { totalQty: number; subtotalCents: number },
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
