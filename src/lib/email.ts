import "server-only";
import { store } from "@/data/store";
import { SITE_URL } from "@/lib/seo";
import { variantChoices } from "@/lib/order-items";

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

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  mdash: "—",
  ndash: "–",
};

/**
 * A readable plain-text version of an HTML email.
 *
 * Sending HTML with no `text/plain` alternative is one of the oldest and most
 * reliable spam signals there is — real senders send both parts, and a lot of
 * bulk mail doesn't bother. Every send goes out as multipart because of this.
 *
 * Links keep their URL in brackets, because in the text part a bare "Pay now"
 * with nowhere to go is worse than useless.
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
      // Keep the destination: "Pay $40.50 (https://…)".
      .replace(
        /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_m, href: string, text: string) => {
          const label = text.replace(/<[^>]+>/g, "").trim();
          if (!label) return href;
          return label === href ? href : `${label} (${href})`;
        },
      )
      .replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, (_m, alt: string) =>
        alt ? `\n${alt}\n` : "",
      )
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      // Both ends of a block: a name followed by a <div> sub-label would
      // otherwise come out as "Sage Baby BonnetSize: 0-3mColor: Sage".
      .replace(/<(p|div|tr|h1|h2|h3|li|table)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|tr|h1|h2|h3|li|table)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, "  ")
      .replace(/<[^>]+>/g, "")
      .replace(/&([a-z]+|#\d+);/gi, (m, name: string) => {
        const key = name.toLowerCase();
        if (ENTITIES[key]) return ENTITIES[key];
        if (key.startsWith("#")) {
          return String.fromCodePoint(Number(key.slice(1)));
        }
        return m;
      })
      // Tidy the ragged whitespace all that tag-stripping leaves behind.
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  /** Defaults to the shop address; contact messages reply to the sender. */
  replyTo?: string;
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
        // Always multipart — see htmlToText.
        text: htmlToText(opts.html),
        reply_to: opts.replyTo ?? store.contact.email,
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
  /** Non-size choices (colour, style, …) as { group: option }. */
  options?: Record<string, string>;
  quantity?: number;
  unitAmountCents?: number;
};

/** A payment method offered in the invoice email, flattened for rendering. */
export type PayOptionLine = {
  id: string;
  label: string;
  detail: string;
  url: string;
  qr: boolean;
};

export type EmailOrder = {
  id: string;
  email: string | null;
  customerName: string | null;
  amountTotalCents: number;
  subtotalCents?: number | null;
  discountCents?: number | null;
  shippingCents?: number | null;
  taxCents?: number | null;
  isGift?: boolean;
  items: EmailItem[];
  carrier?: string | null;
  trackingNumber?: string | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;

/** Escape untrusted, customer-controlled strings before HTML interpolation. */
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
        <td style="padding:8px 0">${esc(it.name)}${variantChoices(it)
          .map(
            (c) =>
              `<div style="font-size:12px;color:#8a8272">${esc(c.label)}: ${esc(c.value)}</div>`,
          )
          .join("")}</td>
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
  if (order.taxCents) parts.push(line("Tax", money(order.taxCents)));
  parts.push(
    `<tr><td style="padding:6px 0 0;font-weight:bold">Total</td><td style="padding:6px 0 0;text-align:right;font-weight:bold">${money(order.amountTotalCents)}</td></tr>`,
  );
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">${parts.join("")}</table>`;
}

// ── Public senders ──────────────────────────────────────────────────────────

/** Order confirmation to the customer. */
export async function sendOrderConfirmation(order: EmailOrder): Promise<boolean> {
  if (!order.email) return false;
  const name = esc(order.customerName?.split(" ")[0] ?? "there");
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
    <p style="margin:0;color:#6a6456">${esc(order.customerName ?? "A customer")}${order.email ? ` (${esc(order.email)})` : ""}${order.isGift ? " · 🎁 gift" : ""}</p>
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

/**
 * Contact-form message to the shop owner. Every field is customer-controlled,
 * so all of it is escaped; the message keeps its line breaks.
 */
export async function sendContactMessage(msg: {
  name: string;
  email: string;
  message: string;
}): Promise<boolean> {
  const inner = `
    <h1 style="font-size:20px;margin:0 0 8px">New message from the website ✉️</h1>
    <p style="margin:0;color:#6a6456">${esc(msg.name)} · <a href="mailto:${esc(msg.email)}" style="color:#5b6b52">${esc(msg.email)}</a></p>
    <div style="margin-top:14px;padding:14px;background:#f6f1e7;border-radius:12px;font-size:14px;white-space:pre-wrap">${esc(msg.message)}</div>
    <p style="margin:18px 0 0;font-size:13px;color:#8a8272">Reply to this email to answer them directly.</p>`;
  return send({
    to: store.contact.email,
    subject: `Contact form — ${msg.name}`,
    html: shell(inner),
    replyTo: msg.email,
  });
}

/**
 * Refund confirmation to the customer.
 *
 * Stripe sends a refund receipt of its own, but only in live mode and only when
 * that email is switched on in the dashboard — so it can't be relied on to tell
 * the customer anything happened. This one always goes out (when Resend is
 * configured), including for manual and imported orders that have no Stripe
 * payment behind them at all.
 */
export async function sendRefundConfirmation(
  order: EmailOrder,
  refund: { amountCents: number; full: boolean; viaStripe: boolean },
): Promise<boolean> {
  if (!order.email) return false;
  const name = esc(order.customerName?.split(" ")[0] ?? "there");
  const timing = refund.viaStripe
    ? "It should land back on your original payment method within 5–10 business days, depending on your bank."
    : "We'll return it the same way you paid — reply to this email if anything looks off.";
  const inner = `
    <h1 style="font-size:22px;margin:0 0 4px">Your refund is on its way</h1>
    <p style="margin:0 0 4px;color:#6a6456">Hi ${name}, we've refunded ${refund.full ? "your full order" : "part of your order"} ${orderRef(order.id)}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
      <tr><td style="padding:6px 0;font-weight:bold">Refunded</td><td style="padding:6px 0;text-align:right;font-weight:bold">${money(refund.amountCents)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#6a6456">${timing}</p>
    <p style="margin:16px 0 0;font-size:14px;color:#6a6456">Thank you for giving us a try — we're sorry this one didn't work out.</p>`;
  return send({
    to: order.email,
    subject: `Refund confirmation — ${store.name} order ${orderRef(order.id)}`,
    html: shell(inner),
  });
}

/** One payment method as a bordered block, with its QR code when it has one. */
function payBlock(opt: {
  label: string;
  detail: string;
  url?: string;
  qrKey?: string;
  note?: string;
  /** Text for a real button — used where there's no QR code to scan. */
  button?: string;
}): string {
  const heading = opt.url
    ? `<a href="${esc(opt.url)}" style="color:#5b6b52;text-decoration:none;font-weight:bold;font-size:15px">${esc(opt.label)}</a>`
    : `<span style="font-weight:bold;font-size:15px">${esc(opt.label)}</span>`;
  // Absolute URL: an emailed image has no page to be relative to.
  const qr = opt.qrKey
    ? `<div style="margin-top:8px"><img src="${SITE_URL}/api/qr/${esc(opt.qrKey)}" width="110" height="110" alt="${esc(opt.label)} QR code" style="display:block;border-radius:8px" /></div>`
    : "";
  const button =
    opt.button && opt.url
      ? `<div style="margin-top:10px"><a href="${esc(opt.url)}" style="display:inline-block;background:#5b6b52;color:#fff;text-decoration:none;padding:9px 18px;border-radius:999px;font-size:14px;font-weight:bold">${esc(opt.button)}</a></div>`
      : "";
  return `<td style="vertical-align:top;padding:12px;border:1px solid #ece5d8;border-radius:12px;width:50%">
    ${heading}
    <div style="font-size:14px;color:#3a352c;margin-top:2px">${esc(opt.detail)}</div>
    ${opt.note ? `<div style="font-size:12px;color:#8a8272;margin-top:4px">${esc(opt.note)}</div>` : ""}
    ${button}
    ${qr}
  </td>`;
}

/**
 * The invoice for a hand-entered sale that hasn't been paid for yet.
 *
 * Deliberately not Stripe's own invoice email. A hand-entered order is nearly
 * always a friend or a relative, so this is the shop's own note, in the shop's
 * own voice, with every way they might actually pay: card, Venmo, Zelle, or
 * cash next time they see her. Venmo and Zelle carry QR codes, since those get
 * paid from a phone.
 */
export async function sendInvoice(
  order: EmailOrder & { payUrl: string; payOptions: PayOptionLine[] },
): Promise<boolean> {
  if (!order.email) return false;
  return send({
    to: order.email,
    subject: `Your order from ${store.name} ${orderRef(order.id)}`,
    html: renderInvoiceHtml(order),
  });
}

/** The invoice body, split out so the template can be rendered and eyeballed. */
export function renderInvoiceHtml(
  order: EmailOrder & { payUrl: string; payOptions: PayOptionLine[] },
): string {
  const name = esc(order.customerName?.split(" ")[0] ?? "there");

  // Two per row so the blocks stay side by side in a phone-width email.
  const blocks = [
    payBlock({
      label: "Card",
      detail: "Pay online",
      url: order.payUrl,
      note: "Secure Stripe page — no account needed.",
      button: `Pay ${money(order.amountTotalCents)}`,
    }),
    ...order.payOptions.map((o) =>
      payBlock({
        label: o.label,
        detail: o.detail,
        url: o.url,
        qrKey: o.qr ? o.id : undefined,
      }),
    ),
    ...(store.payments.acceptsCash
      ? [payBlock({ label: "Cash", detail: "In person", note: "Whenever we next see you." })]
      : []),
  ];
  const rows: string[] = [];
  for (let i = 0; i < blocks.length; i += 2) {
    rows.push(
      `<tr>${blocks[i]}${blocks[i + 1] ?? "<td style=\"width:50%\"></td>"}</tr>`,
      `<tr><td colspan="2" style="height:10px"></td></tr>`,
    );
  }

  const inner = `
    <h1 style="font-size:22px;margin:0 0 6px">Thanks so much, ${name}! 💛</h1>
    <p style="margin:0;color:#6a6456;font-size:15px">Whenever you get a chance, you can take care of payment here!</p>
    ${itemsTable(order, true)}
    ${totals(order)}
    <h2 style="font-size:16px;margin:28px 0 10px">Ways to pay</h2>
    <table style="width:100%;border-collapse:separate;border-spacing:0 0">${rows.join("")}</table>
    <p style="margin:18px 0 0;font-size:13px;color:#8a8272">Card link, if the button doesn't work:<br/><a href="${esc(order.payUrl)}" style="color:#5b6b52;word-break:break-all">${esc(order.payUrl)}</a></p>
    <p style="margin:18px 0 0;font-size:14px;color:#6a6456">Any questions, just hit reply. Thank you for supporting handmade! 🧵</p>`;

  return shell(inner);
}

/** Shipping notification with tracking (if available). */
export async function sendShippingNotification(order: EmailOrder): Promise<boolean> {
  if (!order.email) return false;
  const name = esc(order.customerName?.split(" ")[0] ?? "there");
  const tracking = order.trackingNumber
    ? `<p style="margin:12px 0 0;font-size:14px">Carrier: <strong>${esc(order.carrier ?? "—")}</strong><br/>Tracking: <strong>${esc(order.trackingNumber)}</strong></p>`
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
