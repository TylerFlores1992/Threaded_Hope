import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook receiver.
 *
 * Stripe calls this endpoint when events happen (most importantly
 * `checkout.session.completed`, which means an order was paid). The Stripe
 * Dashboard is already your authoritative order record — this endpoint is where
 * you'd add extra fulfillment side-effects later, e.g. emailing yourself the
 * order or writing it to a database.
 *
 * Requires STRIPE_WEBHOOK_SECRET (see README for `stripe listen` setup).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const body = await req.text(); // raw body required for signature verification

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // ── ADD FULFILLMENT HERE ──
    // e.g. send yourself an email, decrement inventory, save to a database.
    // For now we just log it; the paid order is visible in your Stripe Dashboard.
    console.log(
      `✅ Paid order: ${session.id} — ${session.customer_details?.email ?? "unknown"} — ${
        session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : ""
      }`,
    );
  }

  return NextResponse.json({ received: true });
}
