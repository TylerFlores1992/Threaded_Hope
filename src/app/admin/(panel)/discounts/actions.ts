"use server";

import { revalidatePath } from "next/cache";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPrisma } from "@/lib/db";

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

/* ── Automatic discount rules (DB-backed; applied at checkout, no code) ── */

export async function createRule(
  _prev: { error?: string; ok?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const label = String(formData.get("label") ?? "").trim();
  const kind = String(formData.get("kind") ?? "quantity");
  const thresholdRaw = Number(formData.get("threshold") ?? 0);
  const discountType = String(formData.get("discountType") ?? "percent");
  const value = Number(formData.get("value") ?? 0);

  if (!label) return { error: "Give the rule a name." };
  if (!Number.isFinite(thresholdRaw) || thresholdRaw <= 0) {
    return { error: "Threshold must be greater than 0." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "Discount value must be greater than 0." };
  }
  if (discountType === "percent" && value > 100) {
    return { error: "Percent off must be 1–100." };
  }

  const threshold =
    kind === "spend" ? Math.round(thresholdRaw * 100) : Math.floor(thresholdRaw);

  try {
    const prisma = getPrisma();
    await prisma.discountRule.create({
      data: {
        label,
        kind: kind === "spend" ? "spend" : "quantity",
        threshold,
        percentOff: discountType === "percent" ? Math.round(value) : null,
        amountOffCents: discountType === "amount" ? Math.round(value * 100) : null,
        active: true,
      },
    });
    revalidatePath("/admin/discounts");
    return { ok: `Created rule “${label}”.` };
  } catch {
    return { error: "Could not save the rule (is a database connected?)." };
  }
}

export async function toggleRule(id: string, active: boolean): Promise<void> {
  const prisma = getPrisma();
  await prisma.discountRule.update({ where: { id }, data: { active } });
  revalidatePath("/admin/discounts");
}

export async function deleteRule(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.discountRule.delete({ where: { id } });
  revalidatePath("/admin/discounts");
}
