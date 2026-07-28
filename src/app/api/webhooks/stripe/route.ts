import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { sendOrderConfirmation, sendOwnerNewOrder } from "@/lib/email";

export const runtime = "nodejs";

/** Records the paid order and decrements inventory. Idempotent per session. */
async function recordOrder(session: Stripe.Checkout.Session) {
  if (!prisma) return; // no DB → Stripe Dashboard remains the record
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existing) return; // already processed

  const stripe = getStripe();
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ["data.price.product"],
    limit: 100,
  });

  // Detect local pickup from the chosen shipping option's display name.
  let pickup = false;
  try {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["shipping_cost.shipping_rate"],
    });
    const rate = full.shipping_cost?.shipping_rate;
    const shipName =
      rate && typeof rate === "object" ? (rate.display_name ?? "") : "";
    pickup = /pickup/i.test(shipName);
  } catch {
    /* if we can't resolve the shipping method, treat as a normal shipment */
  }

  const items = lineItems.data.map((li) => {
    const product = li.price?.product as Stripe.Product | undefined;
    return {
      name: li.description ?? product?.name ?? "Item",
      slug:
        product && typeof product === "object"
          ? (product.metadata?.slug ?? null)
          : null,
      size:
        product && typeof product === "object"
          ? (product.metadata?.size ?? null)
          : null,
      quantity: li.quantity ?? 1,
      unitAmountCents: li.price?.unit_amount ?? 0,
    };
  });

  const details = session.customer_details;
  const meta = session.metadata ?? {};
  const isGift = meta.isGift === "1";
  const order = await prisma.order.create({
    data: {
      stripeSessionId: session.id,
      email: details?.email ?? null,
      customerName: details?.name ?? null,
      amountTotalCents: session.amount_total ?? 0,
      subtotalCents: session.amount_subtotal ?? null,
      discountCents: session.total_details?.amount_discount ?? null,
      shippingCents: session.total_details?.amount_shipping ?? null,
      isGift,
      giftMessage: meta.giftMessage ? String(meta.giftMessage) : null,
      pickup,
      currency: session.currency ?? "usd",
      status: "paid",
      shipping: details?.address
        ? ({
            name: details.name,
            address: details.address,
          } as unknown as Prisma.InputJsonValue)
        : undefined,
      items: items as unknown as Prisma.InputJsonValue,
    },
  });

  // Transactional emails — best-effort; never let a mail failure fail the
  // webhook (that would make Stripe retry and double-process). The senders
  // no-op when RESEND_API_KEY isn't set.
  const emailOrder = {
    id: order.id,
    email: order.email,
    customerName: order.customerName,
    amountTotalCents: order.amountTotalCents,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    isGift: order.isGift,
    items,
  };
  await Promise.allSettled([
    sendOrderConfirmation(emailOrder),
    sendOwnerNewOrder(emailOrder),
  ]);

  // Decrement tracked inventory.
  for (const it of items) {
    if (!it.slug) continue;
    const product = await prisma.product.findUnique({
      where: { slug: it.slug },
    });
    if (!product) continue;

    const sizeStock =
      product.sizeStock && typeof product.sizeStock === "object"
        ? ({ ...(product.sizeStock as Record<string, number>) })
        : {};

    if (it.size && typeof sizeStock[it.size] === "number") {
      // Per-size product: decrement the purchased size, mark sold out at 0.
      sizeStock[it.size] = Math.max(0, sizeStock[it.size] - it.quantity);
      const anyLeft = Object.values(sizeStock).some((n) => n > 0);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          sizeStock: sizeStock as Prisma.InputJsonValue,
          inStock: anyLeft && product.inStock,
        },
      });
    } else if (product.stock != null) {
      const newStock = Math.max(0, product.stock - it.quantity);
      await prisma.product.update({
        where: { id: product.id },
        data: { stock: newStock, inStock: newStock > 0 && product.inStock },
      });
    }
  }
}

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
    try {
      await recordOrder(session);
    } catch (err) {
      // Log and return 500 so Stripe retries; recordOrder is idempotent.
      console.error("Failed to record order:", err);
      return NextResponse.json(
        { error: "Failed to record order." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}
