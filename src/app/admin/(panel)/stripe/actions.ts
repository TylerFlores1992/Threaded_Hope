"use server";

import { revalidatePath } from "next/cache";
import { getStripe } from "@/lib/stripe";

/**
 * Pay out the available balance to the connected bank account.
 *
 * Only works when the account is on a MANUAL payout schedule — on the default
 * automatic schedule Stripe moves the money itself and rejects manual payouts.
 * Stripe's own error is passed straight through rather than reworded, since it
 * explains exactly which of those cases you're in.
 */
export async function createPayout(
  amountCents: number,
): Promise<{ ok: boolean; message: string }> {
  const stripe = getStripe();

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  try {
    const balance = await stripe.balance.retrieve();
    const availableUsd = balance.available.find((b) => b.currency === "usd");
    const available = availableUsd?.amount ?? 0;
    if (amountCents > available) {
      return {
        ok: false,
        message: `Only $${(available / 100).toFixed(2)} is available right now. Pending funds can't be paid out until they settle.`,
      };
    }

    const payout = await stripe.payouts.create({
      amount: Math.round(amountCents),
      currency: "usd",
    });
    revalidatePath("/admin/stripe");
    return {
      ok: true,
      message: `Payout of $${(payout.amount / 100).toFixed(2)} started. It usually lands in 1–2 business days.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Stripe rejected the payout.",
    };
  }
}
