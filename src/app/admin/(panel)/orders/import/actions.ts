"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import {
  isShopifyApiConfigured,
  fetchShopifyOrdersPage,
  fetchShopifyCustomers,
  type ShopifyOrder,
} from "@/lib/shopify";
import type { ParsedOrder } from "@/lib/shopify-csv";

/**
 * Import order and customer history from Shopify.
 *
 * Orders are keyed by their Shopify gid in `externalId`, so re-running updates
 * rather than duplicating, and an interrupted import can simply be run again.
 * Customers aren't imported separately — our Customers page is derived from
 * orders — but the marketing list is pulled in so people who subscribed without
 * ordering still appear.
 */

/** Shopify's fulfillment vocabulary → ours. */
function mapFulfillment(status: string): string {
  if (status === "fulfilled") return "shipped";
  if (status === "delivered") return "delivered";
  return "unfulfilled"; // unfulfilled, partially_fulfilled, on_hold, scheduled…
}

/** Shopify's financial vocabulary → ours. */
function mapStatus(status: string): string {
  if (status.includes("refunded")) return status.replace(/_/g, " ");
  if (status === "paid" || status === "partially_paid") return "paid";
  return status.replace(/_/g, " ");
}

function toOrderData(o: ShopifyOrder): Prisma.OrderCreateInput {
  const items = o.lines.map((l) => ({
    name: l.name,
    slug: l.productHandle,
    size: l.variantTitle && l.variantTitle !== "Default Title" ? l.variantTitle : null,
    options: {},
    quantity: l.quantity,
    unitAmountCents: l.unitAmountCents,
  }));

  const fulfillment = mapFulfillment(o.fulfillmentStatus);

  return {
    // Imported orders never had a Stripe session; the gid keeps it unique.
    stripeSessionId: `shopify:${o.id}`,
    externalId: o.id,
    email: o.email,
    customerName: o.customerName,
    amountTotalCents: o.totalCents,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    taxCents: o.taxCents,
    currency: "usd",
    status: mapStatus(o.financialStatus),
    fulfillmentStatus: fulfillment,
    // We don't know when an imported order actually shipped, and guessing the
    // order date would drag the "order to fulfillment" average to zero.
    shippedAt: null,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    notes: [o.number, o.note].filter(Boolean).join(" · ") || null,
    source: "shopify",
    shipping: (o.shipping ?? undefined) as Prisma.InputJsonValue | undefined,
    items: items as unknown as Prisma.InputJsonValue,
    createdAt: new Date(o.createdAt),
  };
}

export type ImportProgress = {
  imported: number;
  updated: number;
  nextCursor: string | null;
  done: boolean;
  /** Oldest order date seen so far — reveals the 60-day cap when it applies. */
  oldestSeen: string | null;
};

export async function importShopifyOrdersBatch(
  cursor: string | null,
): Promise<ImportProgress> {
  const prisma = getPrisma();
  if (!isShopifyApiConfigured()) {
    throw new Error(
      "Shopify Admin API isn't configured. Add SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Vercel.",
    );
  }

  const { orders, nextCursor } = await fetchShopifyOrdersPage(cursor);

  let imported = 0;
  let updated = 0;
  let oldestSeen: string | null = null;

  for (const o of orders) {
    if (!oldestSeen || o.createdAt < oldestSeen) oldestSeen = o.createdAt;

    const data = toOrderData(o);
    const existing = await prisma.order.findFirst({
      where: { externalId: o.id },
      select: { id: true },
    });

    if (existing) {
      // Refresh the mutable parts; don't disturb a label bought on our side.
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          fulfillmentStatus: data.fulfillmentStatus,
          amountTotalCents: data.amountTotalCents,
          trackingNumber: data.trackingNumber,
          carrier: data.carrier,
          items: data.items,
        },
      });
      updated++;
    } else {
      await prisma.order.create({ data });
      imported++;
    }
  }

  if (!nextCursor) {
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/customers");
  }

  return {
    imported,
    updated,
    nextCursor,
    done: nextCursor == null,
    oldestSeen,
  };
}

export type CustomerImportResult = {
  added: number;
  total: number;
  message: string;
};

/** Pull the marketing list so subscribers who never ordered show up too. */
export async function importShopifyCustomers(): Promise<CustomerImportResult> {
  const prisma = getPrisma();
  if (!isShopifyApiConfigured()) {
    throw new Error("Shopify Admin API isn't configured.");
  }

  const customers = await fetchShopifyCustomers();
  const subscribed = customers.filter((c) => c.subscribed);

  let added = 0;
  for (const c of subscribed) {
    const email = c.email.trim().toLowerCase();
    const existing = await prisma.subscriber.findUnique({ where: { email } });
    if (existing) continue;
    await prisma.subscriber.create({ data: { email } });
    added++;
  }

  revalidatePath("/admin/customers");
  return {
    added,
    total: customers.length,
    message:
      customers.length === 0
        ? "Shopify returned no customer emails. That usually means the app hasn't been approved for protected customer data — orders still import, and customers are built from them."
        : `Read ${customers.length} customers, ${subscribed.length} subscribed. Added ${added} new to your list.`,
  };
}

/**
 * Store a batch of orders parsed from Shopify's CSV export in the browser.
 * Keyed the same way as the API import, so running both can't duplicate.
 */
export async function importParsedOrders(
  batch: ParsedOrder[],
): Promise<{ imported: number; updated: number }> {
  const prisma = getPrisma();
  let imported = 0;
  let updated = 0;

  for (const o of batch) {
    const items = o.lines.map((l) => ({
      name: l.name,
      slug: null,
      size: l.variantTitle,
      options: {},
      quantity: l.quantity,
      unitAmountCents: l.unitAmountCents,
    }));

    const data: Prisma.OrderCreateInput = {
      stripeSessionId: `shopify:${o.externalId}`,
      externalId: o.externalId,
      email: o.email,
      customerName: o.customerName,
      amountTotalCents: o.totalCents,
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      shippingCents: o.shippingCents,
      taxCents: o.taxCents,
      currency: "usd",
      status: mapStatus(o.financialStatus),
      fulfillmentStatus: o.fulfillmentStatus,
      shippedAt: null, // the export doesn't say when it actually shipped
      pickup: /pickup/i.test(o.shippingMethod ?? ""),
      notes: [o.number, o.notes].filter(Boolean).join(" · ") || null,
      source: "shopify",
      shipping: (o.shipping ?? undefined) as Prisma.InputJsonValue | undefined,
      items: items as unknown as Prisma.InputJsonValue,
      createdAt: new Date(o.createdAt),
    };

    const existing = await prisma.order.findFirst({
      where: { externalId: o.externalId },
      select: { id: true },
    });

    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          fulfillmentStatus: data.fulfillmentStatus,
          amountTotalCents: data.amountTotalCents,
          items: data.items,
        },
      });
      updated++;
    } else {
      await prisma.order.create({ data });
      imported++;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  return { imported, updated };
}
