import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getProductBySlug } from "@/lib/catalog";
import { resolveUnitPrice } from "@/lib/pricing";
import { isAvailable, sizeAxisOf, optionAxesOf } from "@/lib/stock";
import { getActiveDiscountRules, pickBestRule } from "@/lib/discounts";
import { store } from "@/data/store";

export const runtime = "nodejs";

/**
 * Creates a Stripe Checkout Session from the cart and returns its hosted URL.
 * Prices are looked up server-side from the product data — never trusted from
 * the client — so a tampered cart can't change what's charged.
 */
type IncomingItem = {
  slug: string;
  quantity: number;
  options?: Record<string, string>;
};

type CheckoutBody = {
  items: IncomingItem[];
  isGift?: boolean;
  giftMessage?: string;
  giftFrom?: string;
};

export async function POST(req: Request) {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Payments are not configured yet. Add your Stripe keys to enable checkout." },
      { status: 503 },
    );
  }

  let items: IncomingItem[];
  let isGift = false;
  let giftMessage = "";
  let giftFrom = "";
  try {
    const body = (await req.json()) as CheckoutBody;
    items = body.items;
    isGift = Boolean(body.isGift);
    // Stripe metadata values cap at 500 chars; keep headroom.
    giftMessage = isGift ? String(body.giftMessage ?? "").slice(0, 450) : "";
    giftFrom = isGift ? String(body.giftFrom ?? "").trim().slice(0, 80) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  let totalQty = 0;

  // Tax modes (mutually exclusive):
  //  - STRIPE_TAX_ENABLED=1 → Stripe Tax (automatic, per-destination, ~0.5% fee)
  //  - else STRIPE_TAX_RATE_ID=txr_… → a flat manual rate (free), applied to items
  const autoTax = process.env.STRIPE_TAX_ENABLED === "1";
  let flatTaxRateId = autoTax
    ? undefined
    : process.env.STRIPE_TAX_RATE_ID || undefined;

  // Validate the flat tax rate up front so a bad/mismatched id (e.g. a test-mode
  // rate with a live key, or a typo) can never break checkout — we just skip tax
  // and log it, rather than failing the whole session.
  if (flatTaxRateId) {
    try {
      const rate = await stripe.taxRates.retrieve(flatTaxRateId);
      if (!rate.active) {
        console.error("STRIPE_TAX_RATE_ID is inactive; skipping tax.");
        flatTaxRateId = undefined;
      }
    } catch (err) {
      console.error("STRIPE_TAX_RATE_ID invalid; skipping tax:", err);
      flatTaxRateId = undefined;
    }
  }

  for (const item of items) {
    const product = await getProductBySlug(item.slug);
    // Skip anything unavailable — including a specific size that's sold out.
    if (!product || !isAvailable(product, item.options)) continue;

    const sizeAxis = sizeAxisOf(product);
    const selectedSize = sizeAxis ? item.options?.[sizeAxis.name] : undefined;
    // Reject a made-up size (not one of the product's real options) so a
    // tampered cart can't create an order for a nonexistent variant.
    if (sizeAxis && selectedSize && !sizeAxis.options.includes(selectedSize)) {
      continue;
    }

    // Same check for every other option group (colour, style, …), and collect
    // the valid selections so the webhook can decrement their counts.
    const selectedOptions: Record<string, string> = {};
    let bogusOption = false;
    for (const v of optionAxesOf(product)) {
      const chosen = item.options?.[v.name];
      if (!chosen) continue;
      if (!v.options.includes(chosen)) {
        bogusOption = true;
        break;
      }
      selectedOptions[v.name] = chosen;
    }
    if (bogusOption) continue;

    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
    // Price is resolved server-side from the selected options (e.g. size), so a
    // tampered client price — or a mismatched variant — can't change the charge.
    const unitPrice = resolveUnitPrice(product, item.options);
    subtotal += unitPrice * quantity;
    totalQty += quantity;

    const optionText =
      item.options && Object.keys(item.options).length > 0
        ? Object.entries(item.options)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : undefined;

    line_items.push({
      quantity,
      // Flat manual tax rate (free) when configured and auto tax is off.
      ...(flatTaxRateId ? { tax_rates: [flatTaxRateId] } : {}),
      price_data: {
        currency: "usd",
        unit_amount: Math.round(unitPrice * 100),
        // tax_behavior is only for automatic Stripe Tax. With a manual tax_rate
        // the rate's own inclusive/exclusive setting governs, and setting both
        // conflicts (Stripe errors), so only set it for automatic tax.
        ...(autoTax ? ({ tax_behavior: "exclusive" } as const) : {}),
        product_data: {
          name: product.name,
          ...(optionText ? { description: optionText } : {}),
          // General tangible goods tax category (Stripe Tax).
          tax_code: "txcd_99999999",
          // slug (+ size) lets the webhook map the paid line back to a product
          // and decrement the right per-size count.
          metadata: {
            slug: product.slug,
            ...(selectedSize ? { size: selectedSize } : {}),
            ...(Object.keys(selectedOptions).length > 0
              ? { options: JSON.stringify(selectedOptions) }
              : {}),
          },
        },
      },
    });
  }

  if (line_items.length === 0) {
    return NextResponse.json(
      { error: "None of the items in your cart are available." },
      { status: 400 },
    );
  }

  const freeShipping = subtotal >= store.shipping.freeThreshold;
  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000";

  // Automatic cart discounts (buy-N / spend thresholds). Stripe allows only one
  // discount per session, so when an auto rule applies we use it and turn off
  // the manual promo-code box; otherwise customers can type a code.
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  try {
    const rule = pickBestRule(await getActiveDiscountRules(), {
      totalQty,
      subtotalCents: Math.round(subtotal * 100),
    });
    if (rule) {
      const coupon = await stripe.coupons.create(
        rule.percentOff != null
          ? { percent_off: rule.percentOff, duration: "once", name: rule.label }
          : {
              amount_off: rule.amountOffCents ?? 0,
              currency: "usd",
              duration: "once",
              name: rule.label,
            },
      );
      discounts = [{ coupon: coupon.id }];
    }
  } catch (err) {
    console.error("Auto-discount error (continuing without it):", err);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: freeShipping ? "Free shipping" : "Standard shipping",
            tax_behavior: "exclusive",
            fixed_amount: {
              amount: freeShipping ? 0 : Math.round(store.shipping.flatRate * 100),
              currency: "usd",
            },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
        {
          // Free local pickup — customer collects the order, no shipping charge.
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Local pickup (free)",
            tax_behavior: "exclusive",
            fixed_amount: { amount: 0, currency: "usd" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 1 },
              maximum: { unit: "business_day", value: 3 },
            },
          },
        },
      ],
      // Automatic sales tax — only when explicitly enabled, since it errors if
      // Stripe Tax isn't configured (origin address + registrations) in the
      // dashboard. Enable STRIPE_TAX_ENABLED=1 after setting that up. (Mutually
      // exclusive with the flat manual rate above.)
      ...(autoTax ? { automatic_tax: { enabled: true } } : {}),
      phone_number_collection: { enabled: true },
      metadata: {
        isGift: isGift ? "1" : "0",
        ...(giftMessage ? { giftMessage } : {}),
        ...(giftFrom ? { giftFrom } : {}),
      },
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/cart`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Something went wrong creating your checkout. Please try again." },
      { status: 500 },
    );
  }
}
