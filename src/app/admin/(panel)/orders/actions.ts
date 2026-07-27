"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import { buyLabel } from "@/lib/shipping";

/**
 * Buy a shipping label for an order (via the chosen Shippo rate) and persist
 * the label URL + tracking number on the order.
 */
export async function purchaseLabel(
  orderId: string,
  rateObjectId: string,
): Promise<void> {
  const prisma = getPrisma();
  const { labelUrl, trackingNumber, carrier } = await buyLabel(rateObjectId);
  await prisma.order.update({
    where: { id: orderId },
    data: { labelUrl, trackingNumber, carrier },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}/label`);
}
