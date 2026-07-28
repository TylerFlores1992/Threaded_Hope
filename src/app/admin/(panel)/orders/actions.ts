"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Order, Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { buyLabel, isShippoTestMode } from "@/lib/shipping";
import { sendShippingNotification, type EmailItem } from "@/lib/email";

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
