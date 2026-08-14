import { store } from "@/data/store";

/**
 * Deep links for the informal ways an invoice gets paid.
 *
 * These sit alongside the Stripe card link in the invoice email. A hand-entered
 * order is usually a friend or a relative, and they'd mostly rather Venmo it
 * than type a card number.
 */

/** Digits only — Zelle and tel: links both choke on dashes and spaces. */
const digits = (s: string) => s.replace(/\D/g, "");

export type PayOption = {
  id: "venmo" | "zelle";
  label: string;
  /** What to show under the label — a handle or a phone number. */
  detail: string;
  /** Opens the app on a phone. */
  url: string;
  /** True when the URL is worth turning into a QR code to scan. */
  qr: boolean;
};

/**
 * Venmo's public profile link. On a phone this hands off to the app; on a
 * desktop it's their profile page, which is still enough to pay from.
 */
export function venmoOption(): PayOption | null {
  const handle = store.payments.venmoHandle?.trim();
  if (!handle) return null;
  return {
    id: "venmo",
    label: "Venmo",
    detail: `@${handle}`,
    url: `https://venmo.com/u/${encodeURIComponent(handle)}`,
    qr: true,
  };
}

/**
 * Zelle has no universal deep link — it lives inside each bank's own app — so
 * the phone number is the thing that actually matters, and it's shown in full.
 *
 * The URL is Zelle's own enrolment/QR endpoint, which their app and most
 * banking apps recognise. It's built to their documented shape, but it has not
 * been scanned on a real handset from this codebase; the number underneath it
 * works regardless, which is why the number is never hidden behind the code.
 */
export function zelleOption(): PayOption | null {
  const phone = store.payments.zellePhone?.trim();
  if (!phone) return null;
  const payload = Buffer.from(
    JSON.stringify({
      name: store.payments.zelleName || store.name,
      token: digits(phone),
      action: "payment",
    }),
    "utf8",
  ).toString("base64");
  return {
    id: "zelle",
    label: "Zelle",
    detail: phone,
    url: `https://enroll.zellepay.com/qr-codes?data=${encodeURIComponent(payload)}`,
    qr: true,
  };
}

/** Every informal option that's configured, in the order they're offered. */
export function payOptions(): PayOption[] {
  return [venmoOption(), zelleOption()].filter(
    (o): o is PayOption => o !== null,
  );
}
