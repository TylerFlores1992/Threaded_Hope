"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

/**
 * Record a sale that didn't go through the website (in person, a friend, a
 * craft fair). Payment is assumed already collected — this only writes the
 * order so it counts toward sales, and optionally decrements inventory.
 */
export async function createManualOrder(formData: FormData): Promise<void> {
  const prisma = getPrisma();

  const slugs = formData.getAll("slug").map((v) => String(v));
  const sizes = formData.getAll("size").map((v) => String(v).trim());
  const qtys = formData.getAll("quantity").map((v) => Number(v));
  const prices = formData.getAll("price").map((v) => Number(v));

  const customerName = String(formData.get("customerName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const shippingDollars = Number(formData.get("shipping") ?? 0);
  const decrement = formData.get("decrement") === "on";
  const fulfilled = formData.get("fulfilled") === "on";

  // Resolve the chosen products so names/prices come from the catalog, not the
  // client (a manual price override is still allowed for discounts/gifts).
  const chosen = slugs
    .map((slug, i) => ({
      slug,
      size: sizes[i] || null,
      quantity: Math.max(1, Math.floor(qtys[i] || 1)),
      priceDollars: prices[i],
    }))
    .filter((r) => r.slug);

  if (chosen.length === 0) {
    redirect("/admin/orders/new?error=Add+at+least+one+item.");
  }

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
        quantity: c.quantity,
        unitAmountCents,
      },
    ];
  });

  if (items.length === 0) {
    redirect("/admin/orders/new?error=Could+not+find+those+products.");
  }

  const subtotalCents = items.reduce(
    (n, it) => n + it.unitAmountCents * it.quantity,
    0,
  );
  const shippingCents = Math.max(0, Math.round((shippingDollars || 0) * 100));

  await prisma.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        stripeSessionId: `manual_${Date.now()}_${Math.round(subtotalCents)}`,
        email: email || null,
        customerName: customerName || null,
        amountTotalCents: subtotalCents + shippingCents,
        subtotalCents,
        shippingCents,
        currency: "usd",
        status: "paid",
        source: "manual",
        notes: notes || null,
        // Manual sales are handed over in person unless shipping was charged.
        pickup: shippingCents === 0,
        fulfillmentStatus: fulfilled ? "delivered" : "unfulfilled",
        ...(fulfilled ? { shippedAt: new Date(), deliveredAt: new Date() } : {}),
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    if (!decrement) return;
    for (const it of items) {
      const product = bySlug.get(it.slug);
      if (!product) continue;
      const sizeStock =
        product.sizeStock && typeof product.sizeStock === "object"
          ? { ...(product.sizeStock as Record<string, number>) }
          : {};

      if (it.size && typeof sizeStock[it.size] === "number") {
        sizeStock[it.size] = Math.max(0, sizeStock[it.size] - it.quantity);
        const anyLeft = Object.values(sizeStock).some((n) => n > 0);
        await tx.product.update({
          where: { id: product.id },
          data: {
            sizeStock: sizeStock as Prisma.InputJsonValue,
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
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/shop");
  revalidatePath("/products/[slug]", "page");
  redirect("/admin/orders");
}
