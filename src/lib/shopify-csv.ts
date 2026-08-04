/**
 * Parser for Shopify's order CSV export (Orders → Export → CSV).
 *
 * This is the route to a store's FULL history: the Admin API caps orders at
 * 60 days unless Shopify grants the `read_all_orders` scope, but the CSV export
 * has always contained everything.
 *
 * Shopify writes ONE ROW PER LINE ITEM. The first row of an order carries the
 * order-level fields; the rows after it repeat only `Name` plus their own
 * `Lineitem *` columns, leaving everything else blank. So rows are grouped by
 * `Name`, and order-level values are taken from whichever row actually has them.
 *
 * Plain module (no server-only): parsing happens in the browser so a large
 * export never has to fit inside a request body.
 */

export type ParsedLine = {
  name: string;
  variantTitle: string | null;
  quantity: number;
  unitAmountCents: number;
  sku: string | null;
};

export type ParsedOrder = {
  /** Shopify order id when the export includes one, else the order number. */
  externalId: string;
  number: string;
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
  shippingMethod: string | null;
  notes: string | null;
  lines: ParsedLine[];
};

/** RFC4180-ish CSV reader: handles quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM — Excel-flavoured exports carry one.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Treat CRLF as one break, and skip blank lines.
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

const toCents = (v: string): number => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** "2024-11-02 11:27:38 -0800" → a Date. Falls back to null when unparseable. */
function parseDate(v: string): Date | null {
  if (!v) return null;
  const normalized = v.trim().replace(" ", "T").replace(/\s+([+-]\d{2}:?\d{2})$/, "$1");
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;
  const plain = new Date(v);
  return Number.isNaN(plain.getTime()) ? null : plain;
}

/** Shopify's CSV status words → ours. */
function mapFulfillment(v: string): string {
  const s = v.trim().toLowerCase();
  if (s === "fulfilled") return "shipped";
  if (s === "delivered") return "delivered";
  return "unfulfilled";
}

export type ParseResult = {
  orders: ParsedOrder[];
  /** Columns we needed but couldn't find — surfaced rather than guessed at. */
  missingColumns: string[];
};

/**
 * Turn a Shopify order-export CSV into orders ready to store.
 * Column lookup is case-insensitive, since exports vary in capitalisation.
 */
export function parseShopifyOrdersCsv(text: string): ParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { orders: [], missingColumns: ["(file was empty)"] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const get = (row: string[], name: string): string => {
    const i = idx(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const missingColumns = ["Name", "Created at", "Lineitem name"].filter(
    (c) => idx(c) === -1,
  );
  if (missingColumns.length > 0) return { orders: [], missingColumns };

  const byNumber = new Map<string, ParsedOrder>();

  for (const row of rows.slice(1)) {
    const number = get(row, "Name");
    if (!number) continue;

    let order = byNumber.get(number);
    if (!order) {
      const rawId = get(row, "Id");
      order = {
        // Match the API import's key shape so the two routes can't duplicate
        // each other: the API stores a gid, and a CSV id rebuilds the same one.
        externalId: rawId
          ? `gid://shopify/Order/${rawId}`
          : `shopify-order:${number}`,
        number,
        createdAt: (parseDate(get(row, "Created at")) ?? new Date()).toISOString(),
        email: get(row, "Email") || null,
        customerName:
          get(row, "Shipping Name") || get(row, "Billing Name") || null,
        financialStatus: (get(row, "Financial Status") || "paid").toLowerCase(),
        fulfillmentStatus: mapFulfillment(get(row, "Fulfillment Status")),
        totalCents: toCents(get(row, "Total")),
        subtotalCents: toCents(get(row, "Subtotal")),
        discountCents: toCents(get(row, "Discount Amount")),
        shippingCents: toCents(get(row, "Shipping")),
        taxCents: toCents(get(row, "Taxes")),
        shipping: null,
        shippingMethod: get(row, "Shipping Method") || null,
        notes: get(row, "Notes") || null,
        lines: [],
      };

      const street =
        get(row, "Shipping Address1") || get(row, "Shipping Street");
      const city = get(row, "Shipping City");
      if (street || city) {
        order.shipping = {
          name: get(row, "Shipping Name") || undefined,
          address: {
            line1: street || undefined,
            line2: get(row, "Shipping Address2") || undefined,
            city: city || undefined,
            state:
              get(row, "Shipping Province") ||
              get(row, "Shipping Province Name") ||
              undefined,
            postal_code: get(row, "Shipping Zip") || undefined,
            country: get(row, "Shipping Country") || undefined,
          },
        };
      }
      byNumber.set(number, order);
    }

    // Order-level fields sometimes land on a later row; fill any gaps.
    if (!order.email) order.email = get(row, "Email") || null;
    if (order.totalCents === 0) order.totalCents = toCents(get(row, "Total"));

    const lineName = get(row, "Lineitem name");
    if (lineName) {
      const qty = Number(get(row, "Lineitem quantity")) || 1;
      order.lines.push({
        name: lineName,
        variantTitle: null,
        quantity: qty,
        unitAmountCents: toCents(get(row, "Lineitem price")),
        sku: get(row, "Lineitem sku") || null,
      });
    }
  }

  // Totals are only on the first row of an order; if it's still zero, add up
  // the line items so the order isn't recorded as free.
  for (const o of byNumber.values()) {
    if (o.totalCents === 0) {
      o.totalCents = o.lines.reduce(
        (n, l) => n + l.unitAmountCents * l.quantity,
        0,
      );
    }
  }

  return { orders: [...byNumber.values()], missingColumns: [] };
}
