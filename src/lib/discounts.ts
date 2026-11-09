import "server-only";
import { prisma } from "@/lib/db";
import type { DiscountRule } from "@/lib/discount-rules";

/**
 * Automatic discount rules — applied with no promo code, based on the cart.
 * Manual promo codes stay separate (Stripe promotion codes managed on the
 * Discounts page), and only one discount ever lands on an order: Stripe allows
 * one per Checkout Session, and a hand-recorded sale follows the same rule so
 * the two kinds of order can't disagree about what a total means.
 *
 * Reading the rules needs the database, so it lives here. The shape and the
 * arithmetic live in `lib/discount-rules.ts`, which has no `server-only` on it
 * and can therefore be shared with the admin's client-side forms.
 */

export type { DiscountRule, DiscountCart } from "@/lib/discount-rules";
export { ruleDiscountCents, pickBestRule } from "@/lib/discount-rules";

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
