import "server-only";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { variantValues } from "@/lib/order-items";

/**
 * Billing a customer for a sale instead of collecting on the spot.
 *
 * This uses a Stripe *invoice* rather than a Checkout Session, because a
 * Checkout Session expires within 24 hours. An invoice you email has to stay
 * payable until someone gets round to it, and its hosted page keeps working
 * until the invoice is paid or voided.
 *
 * Stripe can email invoices itself. We finalise it and send our own email so
 * the customer gets the shop's branding, and so the invoice matches the rest of
 * the mail they've had from us.
 */
export type InvoiceLine = {
  name: string;
  size?: string | null;
  /** Non-size choices (colour, style, …) as { group: option }. */
  options?: Record<string, string>;
  quantity: number;
  unitAmountCents: number;
};

export type InvoiceDraft = {
  email: string;
  customerName: string | null;
  phone: string | null;
  lines: InvoiceLine[];
  /** Applied as a one-off negative line, so the total matches the order. */
  discountCents: number;
  discountLabel: string | null;
  shippingCents: number;
  /** Shown on Stripe's page so the customer knows what they're paying for. */
  memo: string | null;
};

export type InvoiceResult =
  | { ok: true; invoiceId: string; payUrl: string }
  | { ok: false; error: string };

/**
 * Create, finalise and return a payable invoice. Nothing is emailed here — the
 * caller decides, so an order is never left half-created if the mail fails.
 */
export async function createPayableInvoice(
  draft: InvoiceDraft,
): Promise<InvoiceResult> {
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe isn't connected, so an invoice can't be raised." };
  }
  const stripe = getStripe();

  try {
    // Reuse a customer with this email so a repeat buyer keeps one Stripe
    // record and their invoice history stays together.
    const existing = await stripe.customers.list({ email: draft.email, limit: 1 });
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({
        email: draft.email,
        ...(draft.customerName ? { name: draft.customerName } : {}),
        ...(draft.phone ? { phone: draft.phone } : {}),
      }));

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      // Long enough that a posted or hand-delivered invoice stays payable.
      days_until_due: 30,
      ...(draft.memo ? { description: draft.memo } : {}),
      metadata: { source: "admin_record_sale" },
    });
    if (!invoice.id) {
      return { ok: false, error: "Stripe didn't return an invoice id." };
    }

    for (const line of draft.lines) {
      // `amount` is the whole line, not a unit price. Using it (rather than
      // price_data + quantity) keeps this from having to create a Stripe
      // Product for every catalog item just to raise one invoice, so the
      // quantity goes in the description instead.
      const v = variantValues(line);
      const label = v ? `${line.name} (${v})` : line.name;
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: line.unitAmountCents * line.quantity,
        currency: "usd",
        description:
          line.quantity > 1 ? `${label} × ${line.quantity}` : label,
      });
    }

    if (draft.shippingCents > 0) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: draft.shippingCents,
        currency: "usd",
        description: "Shipping",
      });
    }

    // A negative line rather than a coupon: the discount was already worked
    // out against this exact subtotal, so a flat amount keeps Stripe's total
    // identical to the order we store.
    if (draft.discountCents > 0) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: -draft.discountCents,
        currency: "usd",
        description: draft.discountLabel ?? "Discount",
      });
    }

    // Finalising is what mints the hosted payment page.
    const finalised = await stripe.invoices.finalizeInvoice(invoice.id);
    const payUrl = finalised.hosted_invoice_url;
    if (!payUrl) {
      return { ok: false, error: "Stripe didn't return a payment link." };
    }
    return { ok: true, invoiceId: finalised.id ?? invoice.id, payUrl };
  } catch (err) {
    console.error("Invoice creation failed:", err);
    const message =
      err instanceof Error ? err.message : "Stripe rejected the invoice.";
    return { ok: false, error: message };
  }
}
