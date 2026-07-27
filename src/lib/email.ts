import "server-only";
import { store } from "@/data/store";
import { SITE_URL } from "@/lib/seo";

/**
 * Transactional email via Resend (REST, no SDK). Everything is gated on
 * `RESEND_API_KEY`; when it's absent, sends are skipped silently so checkout and
 * the webhook never break. Sending failures are caught and logged — they must
 * never bubble into the order flow (a 500 there makes Stripe retry the webhook).
 *
 * From address: `EMAIL_FROM` (e.g. "Threaded Hope <orders@threaded-hope.com>").
 * The sending domain must be verified in Resend before real mail delivers.
 */
const RESEND_URL = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `${store.name} <onboarding@resend.dev>`;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!isEmailConfigured() || !opts.to) return false;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        reply_to: store.contact.email,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Email send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

// ── Types & formatting ──────────────────────────────────────────────────────

export type EmailItem = {
  name: string;
  size?: string | null;
  quantity?: number;
  unitAmountCents?: number;
};

export type EmailOrder = {
  id: string;
  email: string | null;
  customerName: string | null;
  amountTotalCents: number;
  subtotalCents?: number | null;
  discountCents?: number | null;
  shippingCents?: number | null;
  isGift?: boolean;
  items: EmailItem[];
  carrier?: string | null;
  trackingNumber?: string | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;

function shell(bodyInner: string): string {
  return `
  <div style="background:#f6f1e7;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#3a352c">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
      <div style="padding:24px;text-align:center;border-bottom:1px solid #ece5d8">
        <img src="${SITE_URL}/logo.png" alt="${store.name}" style="height:48px;width:auto" />
        <div style="font-size:13px;color:#8a8272;margin-top:6px">${store.tagline}</div>
      </div>
      <div style="padding:24px">${bodyInner}</div>
      <div style="padding:20px 24px;border-top:1px solid #ece5d8;text-align:center;font-size:12px;color:#8a8272">
        <div>${store.name} · <a href="mailto:${store.contact.email}" style="color:#5b6b52">${store.contact.email}</a></div>
        <div style="margin-top:6px;font-style:italic">${store.scripture.text}</div>
      </div>
    </div>
  </div>`;
}

function itemsTable(order: EmailOrder, showPrices: boolean): string {
  const rows = order.items
    .map((it) => {
      const qty = it.quantity ?? 1;
      const amount = showPrices
        ? `<td style="padding:8px 0;text-align:right">${money((it.unitAmountCents ?? 0) * qty)}</td>`
        : "";
      return `<tr style="border-bottom:1px solid #ece5d8">
        <td style="padding:8px 0">${it.name}${it.size ? `<div style="font-size:12px;color:#8a8272">Size: ${it.size}</div>` : ""}</td>
        <td style="padding:8px 0;text-align:center;color:#8a8272">×${qty}</td>
        ${amount}
      </tr>`;
    })
    .join("");
  const head = showPrices
    ? `<tr style="color:#8a8272;font-size:12px;text-align:left"><th style="padding-bottom:6px">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr>`
    : `<tr style="color:#8a8272;font-size:12px;text-align:left"><th style="padding-bottom:6px">Item</th><th style="text-align:center">Qty</th></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">${head}${rows}</table>`;
}

function totals(order: EmailOrder): string {
  const line = (label: string, val: string) =>
    `<tr><td style="padding:2px 0;color:#8a8272">${label}</td><td style="padding:2px 0;text-align:right">${val}</td></tr>`;
  const parts: string[] = [];
  if (order.subtotalCents != null) parts.push(line("Subtotal", money(order.subtotalCents)));
  if (order.discountCents) parts.push(line("Discount", `−${money(order.discountCents)}`));
  if (order.shippingCents != null)
    parts.push(line("Shipping", order.shippingCents === 0 ? "Free" : money(order.shippingCents)));
  parts.push(
    `<tr><td style="padding:6px 0 0;font-weight:bold">Total</td><td style="padding:6px 0 0;text-align:right;font-weight:bold">${money(order.amountTotalCents)}</td></tr>`,
  );
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">${parts.join("")}</table>`;
}

// ── Public senders ──────────────────────────────────────────────────────────

/** Order confirmation to the customer. */
export async function sendOrderConfirmation(order: EmailOrder): Promise<boolean> {
  if (!order.email) return false;
  const name = order.customerName?.split(" ")[0] ?? "there";
  const inner = `
    <h1 style="font-size:22px;margin:0 0 4px">Thank you, ${name}! 💛</h1>
    <p style="margin:0 0 4px;color:#6a6456">We've received your order ${orderRef(order.id)} and are getting it ready.</p>
    ${itemsTable(order, !order.isGift)}
    ${order.isGift ? "" : totals(order)}
    <p style="margin:20px 0 0;font-size:14px;color:#6a6456">We'll email you tracking as soon as it ships. Reply any time with questions.</p>
    <div style="text-align:center;margin-top:20px">
      <a href="${SITE_URL}/shop" style="display:inline-block;background:#5b6b52;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-size:14px">Keep shopping</a>
    </div>`;
  return send({
    to: order.email,
    subject: `Your ${store.name} order ${orderRef(order.id)}`,
    html: shell(inner),
  });
}

/** New-order alert to the shop owner. */
export async function sendOwnerNewOrder(order: EmailOrder): Promise<boolean> {
  const inner = `
    <h1 style="font-size:20px;margin:0 0 8px">New order ${orderRef(order.id)} 🎉</h1>
    <p style="margin:0;color:#6a6456">${order.customerName ?? "A customer"}${order.email ? ` (${order.email})` : ""}${order.isGift ? " · 🎁 gift" : ""}</p>
    ${itemsTable(order, true)}
    ${totals(order)}
    <div style="text-align:center;margin-top:20px">
      <a href="${SITE_URL}/admin/orders" style="display:inline-block;background:#5b6b52;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-size:14px">Open admin</a>
    </div>`;
  return send({
    to: store.contact.email,
    subject: `New order ${orderRef(order.id)} — ${money(order.amountTotalCents)}`,
    html: shell(inner),
  });
}

/** Shipping notification with tracking (if available). */
export async function sendShippingNotification(order: EmailOrder): Promise<boolean> {
  if (!order.email) return false;
  const name = order.customerName?.split(" ")[0] ?? "there";
  const tracking = order.trackingNumber
    ? `<p style="margin:12px 0 0;font-size:14px">Carrier: <strong>${order.carrier ?? "—"}</strong><br/>Tracking: <strong>${order.trackingNumber}</strong></p>`
    : "";
  const inner = `
    <h1 style="font-size:22px;margin:0 0 4px">Your order is on its way! 📦</h1>
    <p style="margin:0;color:#6a6456">Hi ${name}, order ${orderRef(order.id)} has shipped.</p>
    ${tracking}
    ${itemsTable(order, false)}
    <p style="margin:20px 0 0;font-size:14px;color:#6a6456">Thank you for supporting handmade — we hope you love it.</p>`;
  return send({
    to: order.email,
    subject: `Your ${store.name} order has shipped ${orderRef(order.id)}`,
    html: shell(inner),
  });
}
