/**
 * Whether an order's money actually lives in Stripe.
 *
 * Manual sales, imported Shopify history and the Shippo-test sample orders all
 * produce order rows with no Stripe payment behind them. Those can be recorded
 * as refunded so the books match reality, but nothing can be charged back from
 * the admin — the refund has to happen wherever the money was taken.
 *
 * Lives outside the server-actions file because a `"use server"` module may
 * only export async functions.
 */
export function isStripeBackedOrder(order: {
  source: string;
  externalId: string | null;
  stripeSessionId: string;
}): boolean {
  return (
    order.source === "web" &&
    !order.externalId &&
    !order.stripeSessionId.startsWith("test_") &&
    order.stripeSessionId.startsWith("cs_")
  );
}
