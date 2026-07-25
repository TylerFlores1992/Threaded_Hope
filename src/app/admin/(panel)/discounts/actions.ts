"use server";

import { revalidatePath } from "next/cache";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function createDiscount(
  _prev: { error?: string; ok?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  if (!isStripeConfigured()) {
    return { error: "Stripe is not configured." };
  }
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const percent = Number(formData.get("percent") ?? 0);
  const duration = String(formData.get("duration") ?? "once");

  if (!code || !/^[A-Z0-9]{3,}$/.test(code)) {
    return { error: "Code must be 3+ letters/numbers (no spaces)." };
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return { error: "Percent off must be between 1 and 100." };
  }

  try {
    const stripe = getStripe();
    const coupon = await stripe.coupons.create({
      percent_off: percent,
      duration: duration === "forever" ? "forever" : "once",
      name: `${percent}% off`,
    });
    await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
    });
    revalidatePath("/admin/discounts");
    return { ok: `Created code ${code} (${percent}% off).` };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create discount.";
    return { error: message };
  }
}

export async function toggleDiscount(
  id: string,
  active: boolean,
): Promise<void> {
  const stripe = getStripe();
  await stripe.promotionCodes.update(id, { active });
  revalidatePath("/admin/discounts");
}
