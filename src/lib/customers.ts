import { prisma } from "@/lib/db";

/**
 * Customers, derived from recorded orders rather than stored separately.
 *
 * We have no accounts or logins, so an order's email IS the customer identity —
 * deriving means the list is always accurate and there's nothing to keep in
 * sync. Newsletter signups (the `Subscriber` table) are folded in, so someone
 * who subscribed but never bought still appears.
 */
export type CustomerOrder = {
  id: string;
  createdAt: Date;
  amountTotalCents: number;
  fulfillmentStatus: string;
  source: string;
  itemCount: number;
};

export type CustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type Customer = {
  /** Lowercased email — the identity key. */
  email: string;
  name: string | null;
  location: string | null;
  /** Full address from their most recent order that carried one. */
  address: CustomerAddress | null;
  /** Phone from their most recent order that carried one. */
  phone: string | null;
  orderCount: number;
  totalSpentCents: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  subscribed: boolean;
  orders: CustomerOrder[];
};

type ShippingJson = {
  name?: string;
  address?: CustomerAddress;
};

/** "Simi Valley CA, United States" — matches how Shopify prints it. */
function formatLocation(shipping: unknown): string | null {
  if (!shipping || typeof shipping !== "object") return null;
  const addr = (shipping as ShippingJson).address;
  if (!addr) return null;
  const cityState = [addr.city, addr.state].filter(Boolean).join(" ");
  const parts = [cityState, addr.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Every customer, most recently active first. Reads all orders once and folds
 * them together — fine at this scale, and it keeps the query simple.
 */
export async function getCustomers(): Promise<Customer[]> {
  if (!prisma) return [];

  const [orders, subscribers] = await Promise.all([
    prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.subscriber.findMany({ where: { unsubscribedAt: null } }),
  ]);

  const subscribed = new Set(subscribers.map((s) => s.email.toLowerCase()));
  const byEmail = new Map<string, Customer>();

  for (const o of orders) {
    const email = o.email?.trim().toLowerCase();
    if (!email) continue; // an order with no email can't be attributed

    const items = (Array.isArray(o.items) ? o.items : []) as {
      quantity?: number;
    }[];
    const itemCount = items.reduce((n, it) => n + (it.quantity ?? 1), 0);

    let c = byEmail.get(email);
    if (!c) {
      c = {
        email,
        name: null,
        location: null,
        address: null,
        phone: null,
        orderCount: 0,
        totalSpentCents: 0,
        firstOrderAt: null,
        lastOrderAt: null,
        subscribed: subscribed.has(email),
        orders: [],
      };
      byEmail.set(email, c);
    }

    // Orders arrive newest-first, so the first name/location we see is the most
    // recent one they gave us.
    // Orders arrive newest-first, so ??= keeps the most recent non-null.
    c.name ??= o.customerName ?? (o.shipping as ShippingJson)?.name ?? null;
    c.location ??= formatLocation(o.shipping);
    c.address ??= (o.shipping as ShippingJson)?.address ?? null;
    c.phone ??= o.phone ?? null;

    c.orderCount++;
    // Net of refunds: "total spent" should reflect what they actually kept.
    c.totalSpentCents += o.amountTotalCents - o.refundedCents;
    c.lastOrderAt ??= o.createdAt;
    c.firstOrderAt = o.createdAt; // overwritten until the oldest order wins
    c.orders.push({
      id: o.id,
      createdAt: o.createdAt,
      amountTotalCents: o.amountTotalCents,
      fulfillmentStatus: o.fulfillmentStatus,
      source: o.source,
      itemCount,
    });
  }

  // Subscribers who never ordered still belong in the list.
  for (const s of subscribers) {
    const email = s.email.toLowerCase();
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      name: null,
      location: null,
      address: null,
      phone: null,
      orderCount: 0,
      totalSpentCents: 0,
      firstOrderAt: null,
      lastOrderAt: null,
      subscribed: true,
      orders: [],
    });
  }

  return [...byEmail.values()].sort((a, b) => {
    const at = a.lastOrderAt?.getTime() ?? 0;
    const bt = b.lastOrderAt?.getTime() ?? 0;
    return bt - at;
  });
}

/** One customer by email (case-insensitive), or null. */
export async function getCustomer(email: string): Promise<Customer | null> {
  const target = email.trim().toLowerCase();
  const all = await getCustomers();
  return all.find((c) => c.email === target) ?? null;
}
