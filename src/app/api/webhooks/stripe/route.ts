import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { sendOrderConfirmation, sendOwnerNewOrder } from "@/lib/email";
import { computeInStock } from "@/lib/stock";
import type { Variant } from "@/data/products";

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

  /**
   * One expanded fetch covers both things the plain webhook payload omits: the
   * chosen shipping method (to spot local pickup) and the discount behind any
   * reduction. A typed promotion code carries the customer-facing string; an
   * automatic rule carries the coupon name we created it with.
   */
  let pickup = false;
  let discountCode: string | null = null;
  try {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: [
        "shipping_cost.shipping_rate",
        "discounts.promotion_code",
        "discounts.coupon",
      ],
    });

    const rate = full.shipping_cost?.shipping_rate;
    const shipName =
      rate && typeof rate === "object" ? (rate.display_name ?? "") : "";
    pickup = /pickup/i.test(shipName);

    for (const d of full.discounts ?? []) {
      const promo = d.promotion_code;
      if (promo && typeof promo === "object" && promo.code) {
        discountCode = promo.code;
        break;
      }
      const coupon = d.coupon;
      if (coupon && typeof coupon === "object" && coupon.name) {
        discountCode = coupon.name;
        break;
      }
    }
  } catch {
    /* treat as a normal shipment with no named discount */
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
      // Non-size selections (colour, style, …) as { group: option }.
      options: ((): Record<string, string> => {
        const raw =
          product && typeof product === "object"
            ? product.metadata?.options
            : undefined;
        if (!raw) return {};
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return Object.fromEntries(
            Object.entries(parsed)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string]),
          );
        } catch {
          return {};
        }
      })(),
      quantity: li.quantity ?? 1,
      unitAmountCents: li.price?.unit_amount ?? 0,
    };
  });

  const details = session.customer_details;
  const meta = session.metadata ?? {};
  const isGift = meta.isGift === "1";

  /**
   * Where the shipping name and address actually live.
   *
   * Checkout only collects a *shipping* address here, so `customer_details.name`
   * is often null and the admin fell back to showing the email address. The
   * collected shipping details carry the name the customer typed, and the
   * address a label needs — both are preferred, with customer_details as the
   * fallback for older sessions.
   */
  const shippingDetails = session.collected_information?.shipping_details ?? null;
  const customerName =
    shippingDetails?.name ??
    session.collected_information?.individual_name ??
    details?.name ??
    null;
  const shippingAddress = shippingDetails?.address ?? details?.address ?? null;

  // Record the order AND decrement inventory atomically. If any decrement fails,
  // the order create rolls back too, so Stripe's retry re-runs the whole thing
  // cleanly (rather than the retry hitting the idempotency guard with stock
  // never decremented). The `stripeSessionId` unique constraint still prevents
  // duplicate orders under concurrent deliveries.
  const db = prisma;
  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        stripeSessionId: session.id,
        email: details?.email ?? null,
        customerName,
        phone: details?.phone ?? null,
        amountTotalCents: session.amount_total ?? 0,
        subtotalCents: session.amount_subtotal ?? null,
        discountCents: session.total_details?.amount_discount ?? null,
        discountCode,
        shippingCents: session.total_details?.amount_shipping ?? null,
        taxCents: session.total_details?.amount_tax ?? null,
        isGift,
        giftMessage: meta.giftMessage ? String(meta.giftMessage) : null,
        giftFrom: meta.giftFrom ? String(meta.giftFrom) : null,
        pickup,
        currency: session.currency ?? "usd",
        status: "paid",
        shipping: shippingAddress
          ? ({
              name: customerName,
              address: shippingAddress,
            } as unknown as Prisma.InputJsonValue)
          : undefined,
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    for (const it of items) {
      if (!it.slug) continue;
      const product = await tx.product.findUnique({ where: { slug: it.slug } });
      if (!product) continue;

      const sizeStock =
        product.sizeStock && typeof product.sizeStock === "object"
          ? ({ ...(product.sizeStock as Record<string, number>) })
          : {};
      const optionStock: Record<string, Record<string, number>> = {};
      if (product.optionStock && typeof product.optionStock === "object") {
        for (const [g, counts] of Object.entries(
          product.optionStock as Record<string, Record<string, number>>,
        )) {
          if (counts && typeof counts === "object") optionStock[g] = { ...counts };
        }
      }

      const data: Prisma.ProductUpdateInput = {};
      let variantTracked = false;

      if (it.size && typeof sizeStock[it.size] === "number") {
        // Per-size product: decrement the purchased size, sold out at 0.
        sizeStock[it.size] = Math.max(0, sizeStock[it.size] - it.quantity);
        data.sizeStock = sizeStock as Prisma.InputJsonValue;
        variantTracked = true;
      }
      // Each tracked non-size group (colour, style, …) decrements independently.
      for (const [group, option] of Object.entries(it.options)) {
        const counts = optionStock[group];
        if (counts && typeof counts[option] === "number") {
          counts[option] = Math.max(0, counts[option] - it.quantity);
          data.optionStock = optionStock as Prisma.InputJsonValue;
          variantTracked = true;
        }
      }

      if (variantTracked) {
        const variants = (
          Array.isArray(product.variants) ? product.variants : []
        ) as Variant[];
        data.inStock = computeInStock(
          { variants, sizeStock, optionStock, inStock: product.inStock },
          product.inStock,
        );
        await tx.product.update({ where: { id: product.id }, data });
      } else if (product.stock != null) {
        const newStock = Math.max(0, product.stock - it.quantity);
        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock, inStock: newStock > 0 && product.inStock },
        });
      }
    }

    return created;
  });

  // Transactional emails run AFTER the DB commit — best-effort, and never allowed
  // to throw into the webhook (that would make Stripe retry and double-process).
  // The senders no-op when RESEND_API_KEY isn't set.
  const emailOrder = {
    id: order.id,
    email: order.email,
    customerName: order.customerName,
    amountTotalCents: order.amountTotalCents,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    isGift: order.isGift,
    items,
  };
  await Promise.allSettled([
    sendOrderConfirmation(emailOrder),
    sendOwnerNewOrder(emailOrder),
  ]);
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
