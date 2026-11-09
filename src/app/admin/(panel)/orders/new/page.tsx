import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { optionAxesOf, sizeAxisOf } from "@/lib/stock";
import type { Variant } from "@/data/products";
import { getCustomers } from "@/lib/customers";
import { getActiveDiscountRules } from "@/lib/discounts";
import { parseDraftPayload } from "@/lib/order-draft";
import type { SavedDraft } from "@/components/admin/ManualOrderForm";
import {
  ManualOrderForm,
  type PickerCustomer,
  type PickerProduct,
} from "@/components/admin/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to record orders.
      </p>
    );
  }

  const [rows, allCustomers, discountRules, draftRows] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    getCustomers(),
    // Passed to the form so it can show an automatic discount as the items are
    // typed. The server works it out again on submit — this is the preview.
    getActiveDiscountRules(),
    prisma.orderDraft.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  // A draft written by an older shape parses to null and is left out rather
  // than offered as a row that would restore nothing.
  const savedDrafts: SavedDraft[] = draftRows.flatMap((d) => {
    const payload = parseDraftPayload(d.payload);
    if (!payload) return [];
    return [{
      id: d.id,
      label: d.label,
      customerName: d.customerName,
      itemCount: d.itemCount,
      subtotalCents: d.subtotalCents,
      updatedAt: d.updatedAt.toISOString(),
      payload,
    }];
  });

  // Only what the picker searches and fills in — not their whole order history.
  const customers: PickerCustomer[] = allCustomers.map((c) => ({
    email: c.email,
    name: c.name,
    phone: c.phone,
    orderCount: c.orderCount,
    address: c.address,
  }));

  const products: PickerProduct[] = rows.map((p) => {
    const variants = (Array.isArray(p.variants) ? p.variants : []) as Variant[];
    return {
      slug: p.slug,
      name: p.name,
      price: p.priceCents / 100,
      sizes: sizeAxisOf({ variants })?.options ?? [],
      // Colour, style, … — so an in-person sale records the same choices a
      // website order does.
      optionGroups: optionAxesOf({ variants }).map((v) => ({
        name: v.name,
        options: v.options,
      })),
    };
  });

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-ink-soft">
        ← Orders
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">Record a sale</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-soft">
        For sales made outside the website — in person, at a fair, or to a
        friend. Record one you&apos;ve already been paid for, or email an invoice
        they can settle by card, Venmo, Zelle or cash.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ManualOrderForm
        products={products}
        customers={customers}
        discountRules={discountRules}
        hadError={Boolean(error)}
        savedDrafts={savedDrafts}
      />
    </div>
  );
}
