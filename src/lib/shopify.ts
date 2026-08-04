import "server-only";

/**
 * Shopify Admin API client (GraphQL).
 *
 * Auth uses the client credentials grant: the app's client ID and secret are
 * exchanged for a short-lived access token. Shopify only allows this for an app
 * your own organisation owns, installed on your own store — which is exactly
 * our case — and it means no long-lived token is ever stored anywhere.
 *
 * Tokens last 24 hours, so we hold one in memory and refresh a little early.
 * A cold start just fetches a new one; the call is cheap.
 */
const STORE = process.env.SHOPIFY_STORE_DOMAIN ?? "";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-10";

export const isShopifyApiConfigured = () =>
  Boolean(STORE && CLIENT_ID && CLIENT_SECRET);

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Shopify token request failed (${res.status}). Check the client ID and secret, and that the app is installed on ${STORE}. ${detail.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("Shopify returned no access token.");

  // Refresh 5 minutes early so a request never races the expiry.
  const ttl = (data.expires_in ?? 86_400) * 1000 - 5 * 60_000;
  cached = { token: data.access_token, expiresAt: Date.now() + ttl };
  return data.access_token;
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/** Run a GraphQL query against the Admin API. Throws with Shopify's message. */
export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://${STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Shopify API error (${res.status}). ${detail.slice(0, 300)}`);
  }

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    // Missing scopes surface here — worth saying so plainly.
    throw new Error(
      `Shopify API: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!body.data) throw new Error("Shopify API returned no data.");
  return body.data;
}

export type ShopifyVariant = {
  title: string;
  /** Real on-hand count — the thing products.json never exposes. */
  inventoryQuantity: number | null;
  availableForSale: boolean;
  weightOz: number | null;
};

export type ShopifyAdminProduct = {
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  status: string; // ACTIVE | DRAFT | ARCHIVED
  variants: ShopifyVariant[];
};

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        handle
        descriptionHtml
        productType
        vendor
        status
        variants(first: 100) {
          nodes {
            title
            inventoryQuantity
            availableForSale
            inventoryItem {
              measurement { weight { value unit } }
            }
          }
        }
      }
    }
  }
`;

type ProductsPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      title: string;
      handle: string;
      descriptionHtml: string | null;
      productType: string | null;
      vendor: string | null;
      status: string;
      variants: {
        nodes: {
          title: string | null;
          inventoryQuantity: number | null;
          availableForSale: boolean;
          inventoryItem: {
            measurement: {
              weight: { value: number; unit: string } | null;
            } | null;
          } | null;
        }[];
      };
    }[];
  };
};

/** Grams per unit for each weight unit Shopify reports. */
const TO_GRAMS: Record<string, number> = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.3495,
  POUNDS: 453.592,
};

function toOunces(weight: { value: number; unit: string } | null): number | null {
  if (!weight || !weight.value) return null;
  const grams = weight.value * (TO_GRAMS[weight.unit] ?? 1);
  return Math.round((grams / 28.3495) * 10) / 10;
}

/* ────────────────────────── Orders & customers ────────────────────────── */

export type ShopifyOrderLine = {
  name: string;
  variantTitle: string | null;
  quantity: number;
  unitAmountCents: number;
  productHandle: string | null;
};

export type ShopifyOrder = {
  id: string; // gid — our idempotency key
  number: string; // e.g. "#1068"
  createdAt: string;
  email: string | null;
  customerName: string | null;
  financialStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  shipping: {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  } | null;
  trackingNumber: string | null;
  carrier: string | null;
  note: string | null;
  lines: ShopifyOrderLine[];
};

const ORDERS_QUERY = `
  query Orders($cursor: String) {
    orders(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        createdAt
        email
        note
        displayFinancialStatus
        displayFulfillmentStatus
        customer { firstName lastName }
        totalPriceSet { shopMoney { amount } }
        subtotalPriceSet { shopMoney { amount } }
        totalDiscountsSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        totalTaxSet { shopMoney { amount } }
        shippingAddress {
          name address1 address2 city provinceCode zip country
        }
        fulfillments(first: 5) {
          trackingInfo { number company }
        }
        lineItems(first: 100) {
          nodes {
            title
            variantTitle
            quantity
            originalUnitPriceSet { shopMoney { amount } }
            product { handle }
          }
        }
      }
    }
  }
`;

type Money = { shopMoney: { amount: string } } | null;

/** Shopify returns decimal strings; we store integer cents. */
const cents = (m: Money): number =>
  m ? Math.round(Number(m.shopMoney.amount || 0) * 100) : 0;

type OrdersPage = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      id: string;
      name: string;
      createdAt: string;
      email: string | null;
      note: string | null;
      displayFinancialStatus: string | null;
      displayFulfillmentStatus: string | null;
      customer: { firstName: string | null; lastName: string | null } | null;
      totalPriceSet: Money;
      subtotalPriceSet: Money;
      totalDiscountsSet: Money;
      totalShippingPriceSet: Money;
      totalTaxSet: Money;
      shippingAddress: {
        name: string | null;
        address1: string | null;
        address2: string | null;
        city: string | null;
        provinceCode: string | null;
        zip: string | null;
        country: string | null;
      } | null;
      fulfillments: { trackingInfo: { number: string | null; company: string | null }[] }[];
      lineItems: {
        nodes: {
          title: string;
          variantTitle: string | null;
          quantity: number;
          originalUnitPriceSet: Money;
          product: { handle: string } | null;
        }[];
      };
    }[];
  };
};

/**
 * One page of orders, newest first. Returns a cursor so the admin can walk the
 * history in batches without holding it all in memory.
 *
 * Note: without the `read_all_orders` scope Shopify silently returns only the
 * last 60 days — it is not an error, so the caller reports the oldest date it
 * actually saw rather than claiming a complete history.
 */
export async function fetchShopifyOrdersPage(
  cursor: string | null,
): Promise<{ orders: ShopifyOrder[]; nextCursor: string | null }> {
  const data = await shopifyGraphQL<OrdersPage>(ORDERS_QUERY, { cursor });

  const orders = data.orders.nodes.map((o): ShopifyOrder => {
    const tracking = o.fulfillments.flatMap((f) => f.trackingInfo)[0];
    const addr = o.shippingAddress;
    const name =
      [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") ||
      addr?.name ||
      null;

    return {
      id: o.id,
      number: o.name,
      createdAt: o.createdAt,
      email: o.email,
      customerName: name,
      financialStatus: (o.displayFinancialStatus ?? "PAID").toLowerCase(),
      fulfillmentStatus: (o.displayFulfillmentStatus ?? "UNFULFILLED").toLowerCase(),
      totalCents: cents(o.totalPriceSet),
      subtotalCents: cents(o.subtotalPriceSet),
      discountCents: cents(o.totalDiscountsSet),
      shippingCents: cents(o.totalShippingPriceSet),
      taxCents: cents(o.totalTaxSet),
      shipping: addr
        ? {
            name: addr.name ?? undefined,
            address: {
              line1: addr.address1 ?? undefined,
              line2: addr.address2 ?? undefined,
              city: addr.city ?? undefined,
              state: addr.provinceCode ?? undefined,
              postal_code: addr.zip ?? undefined,
              country: addr.country ?? undefined,
            },
          }
        : null,
      trackingNumber: tracking?.number ?? null,
      carrier: tracking?.company ?? null,
      note: o.note,
      lines: o.lineItems.nodes.map((li) => ({
        name: li.title,
        variantTitle: li.variantTitle,
        quantity: li.quantity,
        unitAmountCents: cents(li.originalUnitPriceSet),
        productHandle: li.product?.handle ?? null,
      })),
    };
  });

  return {
    orders,
    nextCursor: data.orders.pageInfo.hasNextPage
      ? data.orders.pageInfo.endCursor
      : null,
  };
}

export type ShopifyCustomer = {
  email: string;
  subscribed: boolean;
};

const CUSTOMERS_QUERY = `
  query Customers($cursor: String) {
    customers(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        email
        emailMarketingConsent { marketingState }
      }
    }
  }
`;

type CustomersPage = {
  customers: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      email: string | null;
      emailMarketingConsent: { marketingState: string | null } | null;
    }[];
  };
};

/**
 * Every customer email and whether they're subscribed. Customers who bought
 * arrive with their orders anyway; this exists to pick up the marketing list —
 * people who subscribed but never ordered.
 */
export async function fetchShopifyCustomers(): Promise<ShopifyCustomer[]> {
  const out: ShopifyCustomer[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 100; page++) {
    const data: CustomersPage = await shopifyGraphQL<CustomersPage>(
      CUSTOMERS_QUERY,
      { cursor },
    );
    for (const c of data.customers.nodes) {
      if (!c.email) continue; // blocked or absent without protected-data access
      out.push({
        email: c.email,
        subscribed: c.emailMarketingConsent?.marketingState === "SUBSCRIBED",
      });
    }
    if (!data.customers.pageInfo.hasNextPage) break;
    cursor = data.customers.pageInfo.endCursor;
  }

  return out;
}

/** Every product in the store, following pagination. */
export async function fetchShopifyProducts(): Promise<ShopifyAdminProduct[]> {
  const out: ShopifyAdminProduct[] = [];
  let cursor: string | null = null;

  // Bounded so a pagination bug can't spin forever (50 × 100 = 5,000 products).
  for (let page = 0; page < 100; page++) {
    const data: ProductsPage = await shopifyGraphQL<ProductsPage>(
      PRODUCTS_QUERY,
      { cursor },
    );
    for (const p of data.products.nodes) {
      out.push({
        title: p.title,
        handle: p.handle,
        descriptionHtml: p.descriptionHtml ?? "",
        productType: p.productType ?? "",
        vendor: p.vendor ?? "",
        status: p.status,
        variants: p.variants.nodes.map((v) => ({
          title: String(v.title ?? "").trim(),
          inventoryQuantity: v.inventoryQuantity,
          availableForSale: v.availableForSale,
          weightOz: toOunces(v.inventoryItem?.measurement?.weight ?? null),
        })),
      });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  return out;
}
