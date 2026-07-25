import Stripe from "stripe";

/**
 * Lazily-created server-side Stripe client.
 * Reads STRIPE_SECRET_KEY from the environment at call time so the app can
 * build and run (browsing, cart) even before keys are configured — only the
 * checkout/webhook routes require it.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (see README).",
    );
  }
  if (!client) client = new Stripe(key);
  return client;
}

export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
