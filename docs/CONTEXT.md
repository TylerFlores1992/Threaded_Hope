# Project Context

Engineering notes for the **Threaded Hope** storefront — architecture, key
decisions, and gotchas. For running/deploying, see [SETUP.md](./SETUP.md). For
editing content, see the root [README](../README.md).

## What this is

A production-quality ecommerce storefront for a small handmade fabric-goods
shop, with a warm, faith-inspired brand. Customer-facing store + real Stripe
payments. **There is no custom admin dashboard** — the Stripe Dashboard is the
order/sales record (see "Commerce model" below).

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** — design tokens are CSS variables in
  `src/app/globals.css` (`@theme inline` maps them to utilities like `bg-cream`,
  `text-sage-deep`).
- **Stripe** (`stripe` server SDK) for payments via hosted Stripe Checkout.
- No database. Product/content data is a static TypeScript layer.

## Architecture

```
src/
  app/
    page.tsx                     home
    shop/                        all products (client filter/sort/search)
    collections/[slug]/          one page per collection (SSG)
    products/[slug]/             product detail (SSG, 63 pages)
    cart/                        cart page
    checkout/                    order review → Stripe redirect
    checkout/success/            post-payment, clears cart
    api/checkout/route.ts        creates Stripe Checkout Session (server)
    api/webhooks/stripe/route.ts Stripe webhook receiver
    our-story/ gifting/ faqs/ contact/ shipping-returns/  content pages
    not-found.tsx                themed 404
  components/                    Header, Footer, CartDrawer, ProductCard, etc.
  data/                          store.ts, collections.ts, products.ts, faqs.ts
  lib/                           cart-context, format, placeholder, stripe
```

### Data layer (`src/data/`)

The single source of editable content. No CMS/DB — everything is typed literals.
- `store.ts` — brand name, tagline, **Scripture line**, contact, socials,
  shipping thresholds (`freeThreshold`, `flatRate`).
- `collections.ts` — 10 collections; each has a `slug`, `hue` (drives placeholder
  color), and optional `featured`.
- `products.ts` — 63 seeded products in a `seed[]` array. **Slugs and placeholder
  images are derived from name+collection at module load**, so editors only fill
  in name/price/description/variants. `COLOR`/`PATTERN` presets reduce repetition.
- `faqs.ts` — FAQ Q&A.

### Cart (`src/lib/cart-context.tsx`)

- Client-side React Context + `useReducer`. Wraps the whole app in
  `layout.tsx` via `<CartProvider>`.
- **Persisted to `localStorage`** (`threaded-hope-cart`) and rehydrated on mount.
- Line identity = slug + a sorted signature of selected variant options
  (`makeLineId`), so the same product in different colors are distinct lines.

### Payments (Stripe Checkout, hosted)

- Flow: cart → `POST /api/checkout` builds a Checkout Session → client redirects
  to Stripe's hosted page → shopper returns to `/checkout/success` (cart clears).
- The mock/demo card form was **removed** — card data never touches our server
  (PCI-simplest). Stripe collects card, email, phone, and US shipping address.

## Commerce model (important)

- **The Stripe Dashboard is the order & sales record.** Paid orders appear there
  with customer, line items, amount, and shipping address; receipts are emailed
  by Stripe. There is intentionally no self-hosted admin UI, inventory system, or
  shipping-label printing.
- `api/webhooks/stripe/route.ts` verifies `checkout.session.completed` and has an
  `ADD FULFILLMENT HERE` hook for future side-effects (email/DB/inventory).

## Gotchas / decisions

- **Server-side pricing is authoritative.** `api/checkout` re-looks-up each
  product's price from `products.ts` by slug and ignores any price sent by the
  client, so a tampered cart can't change the charge. It also skips
  out-of-stock items.
- **Lazy Stripe client** (`lib/stripe.ts` `getStripe()`): reads
  `STRIPE_SECRET_KEY` at call time, not module load — so the app builds and runs
  (browsing/cart) even with no keys. Only the checkout/webhook routes require it.
  `isStripeConfigured()` exists for guards. The checkout API returns HTTP 503
  with a friendly message when the key is absent.
- **Webhook needs the raw body.** The handler uses `await req.text()` (not
  `.json()`) because signature verification runs on the raw payload. Both API
  routes set `export const runtime = "nodejs"` (Stripe SDK is not edge-safe).
- **Placeholder images are generated SVG data URIs** (`lib/placeholder.ts`) — no
  network calls. Because of this we use plain `<img>`, not `next/image`, which
  produces intentional `@next/next/no-img-element` lint **warnings** (not errors).
  Swapping in real photos = add an `image` field and update
  `components/ProductImage.tsx`.
- **Deterministic `createdAt`** in `products.ts` (fixed base date + index) so the
  "newest" sort is stable and doesn't depend on a build clock.
- **Cart persist ordering:** the persist effect skips its first committed render
  (`loaded` ref) so the empty initial state can't clobber a stored cart before
  hydration lands.
- **`package.json` is pinned for Vercel.** `name` is `threaded-hope` (npm
  rejects the repo's underscore/capitals) and `engines.node` is `22.x` so the
  Vercel build image matches local dev.
- **`vercel.json` forces the Next.js preset.** It contains only
  `{ "framework": "nextjs" }`. Without it (or with the Vercel Project's Framework
  Preset left on **"Other"**), the build succeeds but Vercel then looks for a
  static `public/` output dir and fails with *"No Output Directory named public"*.
  A dashboard override to a `public` output directory can still win over this
  file — if that error recurs, clear the override in Vercel → Settings → Build.
- **`metadataBase`** (`layout.tsx`) defaults to `https://threaded-hope.com`,
  overridable via `NEXT_PUBLIC_BASE_URL`, for correct canonical/OG URLs.

## Environment variables

See [SETUP.md](./SETUP.md) for values and setup. Names only here:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL`.
All live in `.env.local` (gitignored); `.env.example` is the committed template.

## Accessibility

Semantic HTML, alt text, keyboard-navigable nav/cart/forms, skip link, visible
focus rings, WCAG-AA-minded contrast.
