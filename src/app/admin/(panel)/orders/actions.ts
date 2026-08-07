"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Order, Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { buyLabel, isShippoTestMode } from "@/lib/shipping";
import {
  sendRefundConfirmation,
  sendShippingNotification,
  type EmailItem,
} from "@/lib/email";
import { computeInStock } from "@/lib/stock";
import { isStripeBackedOrder } from "@/lib/order-refunds";
import type { Variant } from "@/data/products";

/** Build the email payload from a stored order row. */
function toEmailOrder(order: Order) {
  return {
    id: order.id,
    email: order.email,
    customerName: order.customerName,
    amountTotalCents: order.amountTotalCents,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    isGift: order.isGift,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    items: (Array.isArray(order.items) ? order.items : []) as EmailItem[],
  };
}

/**
 * Insert a realistic sample order so the label / packing-slip flow can be tried
 * before real orders exist. Guarded to Shippo test mode only. Uses a real
 * product slug (if any) so per-product weight prefill works on the label page.
 */
export async function createTestOrder(
  isGift = false,
  pickup = false,
): Promise<void> {
  if (!isShippoTestMode()) {
    throw new Error("Sample orders can only be created in Shippo test mode.");
  }
  const prisma = getPrisma();
  const product = await prisma.product.findFirst({
    orderBy: { createdAt: "desc" },
    select: { slug: true, name: true, priceCents: true },
  });

  const items = [
    {
      name: product?.name ?? "Sample handmade item",
      slug: product?.slug ?? null,
      size: null,
      quantity: 1,
      unitAmountCents: product?.priceCents ?? 2500,
    },
  ];
  const subtotalCents = items[0].unitAmountCents;
  const shippingCents = pickup ? 0 : 550;
  const amountTotalCents = subtotalCents + shippingCents;

  await prisma.order.create({
    data: {
      stripeSessionId: `test_${Date.now()}`,
      email: "sample.customer@example.com",
      customerName: "Sample Customer",
      amountTotalCents,
      subtotalCents,
      shippingCents,
      isGift,
      giftMessage: isGift
        ? "Happy birthday! Hope this brings a little joy to your day. 💛"
        : null,
      pickup,
      currency: "usd",
      status: "paid",
      shipping: {
        name: "Sample Customer",
        address: {
          line1: "742 Evergreen Terrace",
          line2: "",
          city: "Portland",
          state: "OR",
          postal_code: "97201",
          country: "US",
        },
      } as unknown as Prisma.InputJsonValue,
      items: items as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/admin/orders");
}

/**
 * Buy a shipping label for an order (via the chosen Shippo rate) and persist
 * the label URL + tracking number on the order.
 */
export async function purchaseLabel(
  orderId: string,
  rateObjectId: string,
): Promise<void> {
  const prisma = getPrisma();
  // Never buy a second label for an order that already has one (Shippo charges
  // real money per label). Send them to the existing-label view instead.
  const already = await prisma.order.findUnique({ where: { id: orderId } });
  if (already?.labelUrl) redirect(`/admin/orders/${orderId}/label`);

  let updated: Order | null = null;
  try {
    const { labelUrl, trackingNumber, carrier } = await buyLabel(rateObjectId);
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        labelUrl,
        trackingNumber,
        carrier,
        // Buying a label marks the order shipped (once) and timestamps it.
        ...(existing?.shippedAt
          ? {}
          : { fulfillmentStatus: "shipped", shippedAt: new Date() }),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Label purchase failed.";
    redirect(
      `/admin/orders/${orderId}/label?buyError=${encodeURIComponent(msg)}`,
    );
  }

  // Notify the customer with tracking — best-effort, never blocks the redirect.
  if (updated) await sendShippingNotification(toEmailOrder(updated));

  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}/label`);
}

/**
 * Manually set an order's fulfillment status. Transitioning to "shipped" the
 * first time sends the customer a shipping email (with tracking if a label was
 * bought). "delivered" timestamps delivery.
 */
export async function setFulfillment(
  orderId: string,
  status: "unfulfilled" | "shipped" | "delivered",
): Promise<void> {
  const prisma = getPrisma();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const firstShip = status === "shipped" && !order.shippedAt;
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: status,
      ...(status === "shipped" && !order.shippedAt ? { shippedAt: new Date() } : {}),
      ...(status === "delivered" && !order.deliveredAt
        ? { deliveredAt: new Date() }
        : {}),
    },
  });

  if (firstShip) await sendShippingNotification(toEmailOrder(updated));
  revalidatePath("/admin/orders");
}

/** Put the items of a refunded order back into stock. Mirrors the webhook's decrement. */
async function restockOrder(
  tx: Prisma.TransactionClient,
  items: { slug?: string | null; size?: string | null; options?: Record<string, string>; quantity?: number }[],
) {
  for (const it of items) {
    if (!it.slug) continue;
    const product = await tx.product.findUnique({ where: { slug: it.slug } });
    if (!product) continue;
    const qty = it.quantity ?? 1;

    const sizeStock =
      product.sizeStock && typeof product.sizeStock === "object"
        ? { ...(product.sizeStock as Record<string, number>) }
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
      sizeStock[it.size] += qty;
      data.sizeStock = sizeStock as Prisma.InputJsonValue;
      variantTracked = true;
    }
    for (const [group, option] of Object.entries(it.options ?? {})) {
      const counts = optionStock[group];
      if (counts && typeof counts[option] === "number") {
        counts[option] += qty;
        data.optionStock = optionStock as Prisma.InputJsonValue;
        variantTracked = true;
      }
    }

    if (variantTracked) {
      const variants = (
        Array.isArray(product.variants) ? product.variants : []
      ) as Variant[];
      // Something is back on the shelf, so the product is purchasable again.
      data.inStock = computeInStock(
        { variants, sizeStock, optionStock, inStock: true },
        true,
      );
      await tx.product.update({ where: { id: product.id }, data });
    } else if (product.stock != null) {
      await tx.product.update({
        where: { id: product.id },
        data: { stock: product.stock + qty, inStock: true },
      });
    }
  }
}

/**
 * Refund an order, in full or in part.
 *
 * Real money leaves the Stripe balance here, so the amount is validated against
 * what's actually left to refund and Stripe's own error is passed through
 * rather than reworded. Stripe emails the customer its refund receipt itself —
 * there's no separate mail from us to duplicate it.
 *
 * Orders with no Stripe payment behind them (manual sales, imported history)
 * are recorded as refunded without a charge being touched, so the books match
 * what happened even when the money moved by cash or through Shopify.
 */
export async function refundOrder(
  orderId: string,
  amountCents: number,
  opts: { restock?: boolean; reason?: string } = {},
): Promise<{ ok: boolean; message: string }> {
  const prisma = getPrisma();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, message: "That order no longer exists." };

  const remaining = order.amountTotalCents - order.refundedCents;
  const amount = Math.round(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }
  if (remaining <= 0) {
    return { ok: false, message: "This order has already been fully refunded." };
  }
  if (amount > remaining) {
    return {
      ok: false,
      message: `Only ${(remaining / 100).toFixed(2)} is left to refund on this order.`,
    };
  }

  let viaStripe = false;
  if (isStripeBackedOrder(order)) {
    if (!isStripeConfigured()) {
      return {
        ok: false,
        message: "Stripe isn't configured, so the payment can't be refunded here.",
      };
    }
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        order.stripeSessionId,
      );
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      if (!pi) {
        return {
          ok: false,
          message:
            "Stripe has no payment recorded for this order — refund it from the Stripe Dashboard.",
        };
      }
      await stripe.refunds.create({
        payment_intent: pi,
        amount,
        ...(opts.reason ? { metadata: { reason: opts.reason.slice(0, 500) } } : {}),
      });
      viaStripe = true;
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : "Stripe rejected the refund.",
      };
    }
  }

  // Stripe has already moved the money at this point, so the bookkeeping must
  // not be allowed to fail halfway: the total and the restock go together.
  const refundedCents = order.refundedCents + amount;
  const full = refundedCents >= order.amountTotalCents;
  // Restock at most once per order. Without this, two partial refunds each put
  // the whole order back on the shelf and the count climbs past what was sold.
  const restocking = Boolean(opts.restock) && !order.restockedAt;
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedCents,
        refundedAt: new Date(),
        refundReason: opts.reason?.trim() || order.refundReason,
        status: full ? "refunded" : "partially_refunded",
        ...(restocking ? { restockedAt: new Date() } : {}),
      },
    });
    if (restocking) {
      await restockOrder(
        tx,
        (Array.isArray(order.items) ? order.items : []) as Parameters<
          typeof restockOrder
        >[1],
      );
    }
  });

  // Best-effort, after the money and the books are settled: a mail failure must
  // never look like a failed refund.
  const emailed = await sendRefundConfirmation(toEmailOrder(order), {
    amountCents: amount,
    full,
    viaStripe,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");

  const money = `$${(amount / 100).toFixed(2)}`;
  const emailNote = emailed ? " We've emailed the customer a confirmation." : "";
  const restockNote = restocking
    ? " Items are back in stock."
    : opts.restock
      ? " Stock was already put back by the earlier refund, so it's unchanged."
      : "";
  return {
    ok: true,
    message: viaStripe
      ? `Refunded ${money}. The money lands back on their card in 5–10 days.${emailNote}${restockNote}`
      : `Recorded a ${money} refund. This order wasn't paid through Stripe, so no money moved — return it however it was paid.${emailNote}${restockNote}`,
  };
}

/** Permanently delete orders. Used by the list's bulk actions. */
export async function deleteOrders(ids: string[]): Promise<{ deleted: number }> {
  const prisma = getPrisma();
  if (ids.length === 0) return { deleted: 0 };
  const { count } = await prisma.order.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  return { deleted: count };
}

/**
 * Remove the sample orders created while Shippo was in test mode. They're
 * identifiable by their placeholder session id, so this can't touch a real one.
 */
export async function deleteSampleOrders(): Promise<{ deleted: number }> {
  const prisma = getPrisma();
  const { count } = await prisma.order.deleteMany({
    where: { stripeSessionId: { startsWith: "test_" } },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  return { deleted: count };
}
