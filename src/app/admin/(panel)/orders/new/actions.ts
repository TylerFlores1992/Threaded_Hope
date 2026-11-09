"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { lookupPromoCode } from "@/lib/promo-codes";
import {
  getActiveDiscountRules,
  pickBestRule,
  ruleDiscountCents,
} from "@/lib/discounts";
import {
  draftHasContent,
  parseDraftPayload,
  summarizeDraft,
} from "@/lib/order-draft";
import { createPayableInvoice } from "@/lib/invoices";
import { sendInvoice } from "@/lib/email";
import { payOptions } from "@/lib/payment-links";

/**
 * Park a sale that isn't certain yet.
 *
 * Distinct from the browser's autosave, which is insurance against losing work
 * by accident: this is deliberate, survives a change of device, and is the
 * answer to "get the order ready, we'll see if she takes it". Saving again
 * against the same id updates that draft rather than breeding copies.
 *
 * Nothing is reserved — stock is untouched and the prices here are only what
 * was typed. `createManualOrder` re-reads the catalog when the sale is really
 * recorded, so a draft left for a fortnight can't bank a stale price.
 */
export async function saveOrderDraft(
  raw: unknown,
  id?: string,
  label?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const payload = parseDraftPayload(raw);
  if (!payload) return { ok: false, error: "That draft couldn't be read." };
  if (!draftHasContent(payload)) {
    return { ok: false, error: "There's nothing to save yet." };
  }

  const prisma = getPrisma();
  const { itemCount, subtotalCents } = summarizeDraft(payload);
  const data = {
    label: label?.trim() || null,
    customerName: payload.customerName.trim() || null,
    itemCount,
    subtotalCents,
    payload: payload as unknown as Prisma.InputJsonValue,
  };

  try {
    // `update` throws if the row is gone — a draft deleted in another tab
    // shouldn't lose the work, so fall back to writing a fresh one.
    const saved = id
      ? await prisma.orderDraft
          .update({ where: { id }, data })
          .catch(() => prisma.orderDraft.create({ data }))
      : await prisma.orderDraft.create({ data });
    revalidatePath("/admin/orders/new");
    return { ok: true, id: saved.id };
  } catch (err) {
    console.error("Saving the draft failed:", err);
    return { ok: false, error: "Couldn't save that draft." };
  }
}

/** Throw away a parked sale. */
export async function deleteOrderDraft(id: string): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.orderDraft.delete({ where: { id } });
  } catch {
    /* already gone is the outcome we wanted */
  }
  revalidatePath("/admin/orders/new");
}

/** Check a promo code from the form without submitting it. */
export async function checkPromoCode(
  code: string,
  subtotalCents: number,
): Promise<
  | { ok: true; code: string; label: string; discountCents: number }
  | { ok: false; error: string }
> {
  return lookupPromoCode(code, subtotalCents);
}

type ShippingAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

/** The address fields, or null when nothing usable was filled in. */
function readAddress(formData: FormData): ShippingAddress | null {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const line1 = get("addrLine1");
  const city = get("addrCity");
  const state = get("addrState");
  const postal = get("addrPostal");
  if (!line1 || !city || !state || !postal) return null;
  return {
    line1,
    line2: get("addrLine2") || null,
    city,
    state,
    postal_code: postal,
    country: get("addrCountry") || "US",
  };
}

/**
 * Bail out back to the form with a message. Declared as a function statement,
 * not an arrow const, so TypeScript narrows on the `never` return and the code
 * after a `fail()` is understood to be unreachable.
 */
function fail(message: string): never {
  redirect(`/admin/orders/new?error=${encodeURIComponent(message)}`);
}

/**
 * Record a sale that didn't go through the website (in person, a friend, a
 * craft fair), or bill one by emailing an invoice.
 *
 * Two outcomes, chosen by the `payment` field:
 *  - `paid`    — the money is already in hand; the order is written as paid.
 *  - `invoice` — nothing has been collected; a Stripe invoice is raised, the
 *                customer is emailed a pay link, and the order is written as
 *                pending until Stripe reports it paid.
 */
export async function createManualOrder(formData: FormData): Promise<void> {
  const prisma = getPrisma();

  const slugs = formData.getAll("slug").map((v) => String(v));
  const sizes = formData.getAll("size").map((v) => String(v).trim());
  // Non-size choices (colour, style, …) per row, as a JSON blob each, matching
  // the shape the Stripe webhook writes so both kinds of order read alike.
  const optionBlobs = formData.getAll("options").map((v) => String(v));
  const qtys = formData.getAll("quantity").map((v) => Number(v));
  const prices = formData.getAll("price").map((v) => Number(v));

  const customerName = String(formData.get("customerName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const shippingDollars = Number(formData.get("shipping") ?? 0);
  const decrement = formData.get("decrement") === "on";
  const ship = formData.get("delivery") === "ship";
  const byInvoice = formData.get("payment") === "invoice";
  const promoCode = String(formData.get("promoCode") ?? "").trim();
  // Set when this sale was opened from a parked draft, so recording it retires
  // that draft rather than leaving a copy to be recorded a second time.
  const draftId = String(formData.get("draftId") ?? "").trim();

  // Resolve the chosen products so names/prices come from the catalog, not the
  // client (a manual price override is still allowed for discounts/gifts).
  const parseOptions = (raw: string | undefined): Record<string, string> => {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed)
          .filter(([, v]) => typeof v === "string" && v !== "")
          .map(([k, v]) => [k, v as string]),
      );
    } catch {
      return {};
    }
  };

  const chosen = slugs
    .map((slug, i) => ({
      slug,
      size: sizes[i] || null,
      options: parseOptions(optionBlobs[i]),
      quantity: Math.max(1, Math.floor(qtys[i] || 1)),
      priceDollars: prices[i],
    }))
    .filter((r) => r.slug);

  if (chosen.length === 0) fail("Add at least one item.");

  const products = await prisma.product.findMany({
    where: { slug: { in: chosen.map((c) => c.slug) } },
  });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const items = chosen.flatMap((c) => {
    const p = bySlug.get(c.slug);
    if (!p) return [];
    const unitAmountCents =
      Number.isFinite(c.priceDollars) && c.priceDollars >= 0
        ? Math.round(c.priceDollars * 100)
        : p.priceCents;
    return [
      {
        name: p.name,
        slug: p.slug,
        size: c.size,
        ...(Object.keys(c.options).length > 0 ? { options: c.options } : {}),
        quantity: c.quantity,
        unitAmountCents,
      },
    ];
  });

  if (items.length === 0) fail("Could not find those products.");

  const subtotalCents = items.reduce(
    (n, it) => n + it.unitAmountCents * it.quantity,
    0,
  );
  const shippingCents = ship
    ? Math.max(0, Math.round((shippingDollars || 0) * 100))
    : 0;

  // Three of one thing is a three-item order, the same as one each of three
  // things — this is the count the quantity rules are written against, and it
  // matches how `api/checkout` totals a website cart.
  const totalQty = items.reduce((n, it) => n + it.quantity, 0);

  // Re-check the code server-side. The browser already showed the shop owner
  // what it takes off, but that figure can't be trusted to come back unchanged.
  //
  // Failing that, the automatic rules get their turn. A sale recorded by hand
  // is the same sale as one taken on the website, so a bundle rule the site
  // would have applied has to apply here too — it didn't, which meant an
  // in-person customer quietly paid full price for an order the website would
  // have discounted. One discount per order, like Stripe enforces for a
  // checkout: a code the owner typed is deliberate, so it wins over a rule
  // that would have fired on its own.
  let discountCents = 0;
  let discountLabel: string | null = null;
  if (promoCode) {
    const promo = await lookupPromoCode(promoCode, subtotalCents);
    if (!promo.ok) fail(`Discount code: ${promo.error}`);
    discountCents = promo.discountCents;
    discountLabel = promo.code;
  } else {
    try {
      const rule = pickBestRule(await getActiveDiscountRules(), {
        totalQty,
        subtotalCents,
      });
      if (rule) {
        // `rule.label` is what the website's own automatic discount stores in
        // `discountCode` — `api/checkout` names the one-off Stripe coupon after
        // it and the webhook reads that name back — so both kinds of order
        // describe the same rule the same way on the slip, the CSV and the
        // order page.
        discountCents = Math.min(
          ruleDiscountCents(rule, { totalQty, subtotalCents }),
          subtotalCents,
        );
        discountLabel = discountCents > 0 ? rule.label : null;
      }
    } catch (err) {
      // An unreachable rules table shouldn't block recording a sale: the order
      // is the thing that matters, and it can be edited after.
      console.error("Auto-discount lookup failed (recording without it):", err);
    }
  }

  const amountTotalCents = subtotalCents - discountCents + shippingCents;
  const address = ship ? readAddress(formData) : null;

  if (ship && !address) {
    fail("A shipping address is needed to ship this order.");
  }

  // Everything an invoice needs has to be in place before anything is written,
  // so a rejected invoice doesn't leave an order behind.
  let invoiceId: string | null = null;
  let invoiceUrl: string | null = null;
  if (byInvoice) {
    if (!email) fail("An email address is needed to send an invoice.");
    const invoice = await createPayableInvoice({
      email,
      customerName: customerName || null,
      phone: phone || null,
      lines: items.map((it) => ({
        name: it.name,
        size: it.size,
        quantity: it.quantity,
        unitAmountCents: it.unitAmountCents,
      })),
      discountCents,
      discountLabel,
      shippingCents,
      memo: notes || null,
    });
    if (!invoice.ok) fail(invoice.error);
    invoiceId = invoice.invoiceId;
    invoiceUrl = invoice.payUrl;
  }

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        // The invoice id doubles as the payment reference, which is what lets
        // the `invoice.paid` webhook find this row again.
        stripeSessionId:
          invoiceId ?? `manual_${Date.now()}_${Math.round(subtotalCents)}`,
        email: email || null,
        customerName: customerName || null,
        phone: phone || null,
        amountTotalCents,
        subtotalCents,
        discountCents: discountCents || null,
        discountCode: discountLabel,
        shippingCents,
        currency: "usd",
        // An invoiced sale isn't money yet, so it stays out of revenue until
        // Stripe says otherwise.
        status: byInvoice ? "pending" : "paid",
        invoiceUrl,
        source: "manual",
        notes: notes || null,
        pickup: !ship,
        ...(address
          ? {
              shipping: {
                name: customerName || null,
                address,
              } as unknown as Prisma.InputJsonValue,
            }
          : {}),
        // Every order starts unfulfilled and is moved on from the order list —
        // an in-person sale that hasn't been handed over yet is a real state,
        // and assuming otherwise here hid those orders from the to-do queue.
        fulfillmentStatus: "unfulfilled",
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    if (!decrement) return order;
    for (const it of items) {
      const product = bySlug.get(it.slug);
      if (!product) continue;
      const sizeStock =
        product.sizeStock && typeof product.sizeStock === "object"
          ? { ...(product.sizeStock as Record<string, number>) }
          : {};

      const optionStock =
        product.optionStock && typeof product.optionStock === "object"
          ? (JSON.parse(JSON.stringify(product.optionStock)) as Record<
              string,
              Record<string, number>
            >)
          : {};
      // Each tracked non-size group (colour, style, …) decrements on its own,
      // the same way the Stripe webhook does it for a website order.
      let optionTouched = false;
      for (const [group, option] of Object.entries(
        (it as { options?: Record<string, string> }).options ?? {},
      )) {
        const counts = optionStock[group];
        if (counts && typeof counts[option] === "number") {
          counts[option] = Math.max(0, counts[option] - it.quantity);
          optionTouched = true;
        }
      }

      if (it.size && typeof sizeStock[it.size] === "number") {
        sizeStock[it.size] = Math.max(0, sizeStock[it.size] - it.quantity);
        const anyLeft = Object.values(sizeStock).some((n) => n > 0);
        await tx.product.update({
          where: { id: product.id },
          data: {
            sizeStock: sizeStock as Prisma.InputJsonValue,
            ...(optionTouched
              ? { optionStock: optionStock as Prisma.InputJsonValue }
              : {}),
            inStock: anyLeft && product.inStock,
          },
        });
      } else if (optionTouched) {
        const anyLeft = Object.values(optionStock).every((counts) =>
          Object.values(counts).some((n) => n > 0),
        );
        await tx.product.update({
          where: { id: product.id },
          data: {
            optionStock: optionStock as Prisma.InputJsonValue,
            inStock: anyLeft && product.inStock,
          },
        });
      } else if (product.stock != null) {
        const newStock = Math.max(0, product.stock - it.quantity);
        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock, inStock: newStock > 0 && product.inStock },
        });
      }
    }
    return order;
  });

  // Emailed last, and never fatally: the invoice exists and is payable either
  // way, and the order page shows the link to send by hand if this fails.
  if (byInvoice && invoiceUrl && email) {
    try {
      await sendInvoice({
        id: created.id,
        email,
        customerName: customerName || null,
        amountTotalCents,
        subtotalCents,
        discountCents,
        shippingCents,
        items,
        payUrl: invoiceUrl,
        payOptions: payOptions(),
      });
    } catch (err) {
      console.error("Invoice email failed (the invoice is still payable):", err);
    }
  }

  // The sale exists now, so the draft of it is finished business. Best-effort:
  // a stuck draft is a tidiness problem, not a reason to error after the money
  // has been recorded.
  if (draftId) {
    try {
      await prisma.orderDraft.delete({ where: { id: draftId } });
    } catch {
      /* already deleted, or never existed */
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/new");
  revalidatePath("/admin");
  revalidatePath("/shop");
  revalidatePath("/products/[slug]", "page");
  redirect(`/admin/orders/${created.id}`);
}
