import "server-only";
import { store } from "@/data/store";

/**
 * Thin Shippo REST client for buying + printing shipping labels from the admin.
 *
 * No SDK dependency — we call the Shippo API directly. Everything is gated on
 * `SHIPPO_API_KEY`; when it's absent the admin shows setup instructions instead
 * of the buy-a-label UI, so the app builds and runs fine without it.
 *
 * Flow: createShipment() returns live carrier rates → buyLabel(rateId) purchases
 * the chosen rate and returns the printable label URL + tracking number.
 */

const API = "https://api.goshippo.com";

export function isShippingConfigured(): boolean {
  return Boolean(process.env.SHIPPO_API_KEY);
}

/** True while a Shippo TEST token is configured — gates test-only tooling. */
export function isShippoTestMode(): boolean {
  return Boolean(process.env.SHIPPO_API_KEY?.startsWith("shippo_test_"));
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export type Parcel = {
  length: number; // inches
  width: number;
  height: number;
  weightOz: number; // ounces
};

export type Rate = {
  objectId: string;
  provider: string; // "USPS", "UPS", …
  servicelevel: string; // human-readable service name
  amount: string; // e.g. "7.50"
  currency: string;
  estimatedDays: number | null;
};

export type ShipToAddress = {
  name?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
};

type ShippoRate = {
  object_id: string;
  provider: string;
  servicelevel?: { name?: string };
  amount: string;
  currency: string;
  estimated_days?: number | null;
};

/**
 * Create a Shippo shipment and return its live rates (cheapest first).
 * Throws with a readable message on validation / auth failures.
 */
export async function createShipment(
  to: ShipToAddress,
  parcel: Parcel,
): Promise<{ rates: Rate[]; messages: string[] }> {
  const from = store.shipFrom;
  const body = {
    address_from: {
      name: from.name,
      street1: from.street1,
      street2: from.street2 || undefined,
      city: from.city,
      state: from.state,
      zip: from.zip,
      country: from.country,
      phone: from.phone || undefined,
      email: from.email || undefined,
    },
    address_to: {
      name: to.name ?? "",
      street1: to.street1 ?? "",
      street2: to.street2 || undefined,
      city: to.city ?? "",
      state: to.state ?? "",
      zip: to.zip ?? "",
      country: to.country ?? "US",
      phone: to.phone || undefined,
      email: to.email || undefined,
    },
    parcels: [
      {
        length: String(parcel.length),
        width: String(parcel.width),
        height: String(parcel.height),
        distance_unit: "in",
        weight: String(parcel.weightOz),
        mass_unit: "oz",
      },
    ],
    async: false,
  };

  const res = await fetch(`${API}/shipments/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo error (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    rates?: ShippoRate[];
    messages?: { text?: string }[];
  };
  const rates: Rate[] = (data.rates ?? [])
    .map((r) => ({
      objectId: r.object_id,
      provider: r.provider,
      servicelevel: r.servicelevel?.name ?? "",
      amount: r.amount,
      currency: r.currency,
      estimatedDays: r.estimated_days ?? null,
    }))
    .sort((a, b) => Number(a.amount) - Number(b.amount));
  const messages = (data.messages ?? [])
    .map((m) => m.text ?? "")
    .filter(Boolean);
  return { rates, messages };
}

/**
 * Purchase the given rate and return the printable label. label_file_type PDF
 * so it prints cleanly on a normal printer.
 */
export async function buyLabel(rateObjectId: string): Promise<{
  labelUrl: string;
  trackingNumber: string;
  carrier: string;
}> {
  const res = await fetch(`${API}/transactions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      rate: rateObjectId,
      label_file_type: "PDF",
      async: false,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo error (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    status?: string;
    label_url?: string;
    tracking_number?: string;
    messages?: { text?: string }[];
    rate?: { provider?: string };
  };
  if (data.status !== "SUCCESS" || !data.label_url) {
    const msg =
      (data.messages ?? []).map((m) => m.text).filter(Boolean).join("; ") ||
      "Label purchase failed.";
    throw new Error(msg);
  }
  return {
    labelUrl: data.label_url,
    trackingNumber: data.tracking_number ?? "",
    carrier: data.rate?.provider ?? "",
  };
}
