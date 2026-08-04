"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { isShopifyApiConfigured, fetchShopifyCustomers } from "@/lib/shopify";
import type { ParsedOrder } from "@/lib/shopify-csv";

/**
 * Import order and customer history from Shopify.
 *
 * Orders come from the CSV export, parsed in the browser: the Admin API caps
 * orders at 60 days without the `read_all_orders` scope, while the export holds
 * everything. Orders are keyed by their Shopify id in `externalId`, so
 * re-running updates rather than duplicating.
 *
 * Customers aren't imported separately — our Customers page is derived from
 * orders — but the marketing list is pulled in so people who subscribed without
 * ordering still appear.
 */

/** Shopify's financial vocabulary → ours. */
function mapStatus(status: string): string {
  if (status.includes("refunded")) return status.replace(/_/g, " ");
  if (status === "paid" || status === "partially_paid") return "paid";
  return status.replace(/_/g, " ");
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
