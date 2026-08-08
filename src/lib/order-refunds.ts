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

/**
 * A fully refunded order — the customer has been given everything back.
 *
 * A *partial* refund deliberately doesn't count: refunding the shipping, or one
 * item of three, still leaves a parcel to send.
 */
export function isFullyRefunded(order: {
  amountTotalCents: number;
  refundedCents: number;
}): boolean {
  return order.amountTotalCents > 0 && order.refundedCents >= order.amountTotalCents;
}

/**
 * Whether an order is still work to do. Used for the "To ship" figure, the
 * Unfulfilled tab and its count, so they all agree — a refunded order isn't a
 * parcel waiting to go out, and shouldn't sit in the queue looking like one.
 */
export function needsFulfilment(order: {
  amountTotalCents: number;
  refundedCents: number;
  fulfillmentStatus: string;
}): boolean {
  return order.fulfillmentStatus === "unfulfilled" && !isFullyRefunded(order);
}
