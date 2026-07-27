"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { buyLabel, isShippoTestMode } from "@/lib/shipping";

/**
 * Insert a realistic sample order so the label / packing-slip flow can be tried
 * before real orders exist. Guarded to Shippo test mode only. Uses a real
 * product slug (if any) so per-product weight prefill works on the label page.
 */
export async function createTestOrder(): Promise<void> {
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
  const amountTotalCents = items[0].unitAmountCents + 550; // + sample shipping

  await prisma.order.create({
    data: {
      stripeSessionId: `test_${Date.now()}`,
      email: "sample.customer@example.com",
      customerName: "Sample Customer",
      amountTotalCents,
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
  try {
    const { labelUrl, trackingNumber, carrier } = await buyLabel(rateObjectId);
    await prisma.order.update({
      where: { id: orderId },
      data: { labelUrl, trackingNumber, carrier },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Label purchase failed.";
    redirect(
      `/admin/orders/${orderId}/label?buyError=${encodeURIComponent(msg)}`,
    );
  }
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}/label`);
}
