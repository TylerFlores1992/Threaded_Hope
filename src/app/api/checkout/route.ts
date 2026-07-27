import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getProductBySlug } from "@/lib/catalog";
import { resolveUnitPrice } from "@/lib/pricing";
import { isAvailable, sizeAxisOf } from "@/lib/stock";
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
  try {
    const body = await req.json();
    items = body.items;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  let totalQty = 0;

  for (const item of items) {
    const product = await getProductBySlug(item.slug);
    // Skip anything unavailable — including a specific size that's sold out.
    if (!product || !isAvailable(product, item.options)) continue;

    const sizeAxis = sizeAxisOf(product);
    const selectedSize = sizeAxis ? item.options?.[sizeAxis.name] : undefined;

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
      price_data: {
        currency: "usd",
        unit_amount: Math.round(unitPrice * 100),
        product_data: {
          name: product.name,
          ...(optionText ? { description: optionText } : {}),
          // slug (+ size) lets the webhook map the paid line back to a product
          // and decrement the right per-size count.
          metadata: {
            slug: product.slug,
            ...(selectedSize ? { size: selectedSize } : {}),
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
            fixed_amount: { amount: 0, currency: "usd" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 1 },
              maximum: { unit: "business_day", value: 3 },
            },
          },
        },
      ],
      phone_number_collection: { enabled: true },
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
