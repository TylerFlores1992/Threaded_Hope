# Project Context

Engineering notes for the **Threaded Hope** storefront — architecture, key
decisions, and gotchas. For running/deploying, see [SETUP.md](./SETUP.md). For
editing content, see the root [README](../README.md).

## What this is

A production-quality ecommerce storefront for a small handmade fabric-goods
shop, with a warm, faith-inspired brand. Customer-facing store + real Stripe
payments, backed by a **Shopify-style admin** at `/admin` for managing products,
orders, inventory, discounts, and traffic. Stripe remains the authoritative
payment/receipt record; the app's database mirrors orders and drives the catalog.

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** — design tokens are CSS variables in
  `src/app/globals.css` (`@theme inline` maps them to utilities like `bg-cream`,
  `text-sage-deep`).
- **Stripe** (`stripe` server SDK) for payments via hosted Stripe Checkout and
  for promo codes.
- **Postgres via Prisma** (Neon, added through the Vercel integration) as the
  catalog + orders + traffic store. **The app still builds and runs with no
  database** — it falls back to the static seed (see "Catalog data layer").
- **Vercel Blob** for product photo uploads.

## Architecture

```
src/
  app/
    page.tsx                     home
    shop/                        all products (client filter/sort/search)
    collections/[slug]/          one page per collection (ISR)
    products/[slug]/             product detail (ISR)
    cart/                        cart page
    checkout/                    order review → Stripe redirect
    checkout/success/            post-payment, clears cart
    api/checkout/route.ts        creates Stripe Checkout Session (server)
    api/webhooks/stripe/route.ts records paid orders + decrements inventory
    api/track/route.ts           records storefront page views
    admin/
      login/                     password login (bare, no admin chrome)
      actions.ts                 login / logout server actions
      (panel)/                   authenticated admin (shared sidebar layout)
        page.tsx                 dashboard (stats + recent orders)
        products/                list · new · [id]/edit · actions.ts
        orders/                  recorded orders
        inventory/               stock editing (+ actions.ts)
        discounts/               Stripe promo codes (+ actions.ts)
        traffic/                 page-view analytics
    our-story/ gifting/ faqs/ contact/ shipping-returns/  content pages
    not-found.tsx                themed 404
  middleware.ts                  gates /admin/* on the session cookie
  components/                    Header, Footer, CartDrawer, ProductCard,
                                 ChromeGate, TrafficTracker, admin/*
  data/                          store.ts, collections.ts, products.ts, faqs.ts
                                 (static seed + fallback catalog)
  lib/                           cart-context, format, placeholder, stripe,
                                 db (Prisma), catalog (DB-or-static), pricing, auth
prisma/
  schema.prisma                  Product, Order, Pageview models
  seed.ts                        one-time seed from the static catalog
  deploy.mjs                     build step: db push + seed when a DB exists
scripts/
  migrate-images.mjs             move product photos Shopify CDN → Vercel Blob
  backfill-collections.ts        apply static-catalog collection membership to DB
  clean-descriptions.ts          strip emoji from product descriptions in the DB
```

### Catalog data layer (`src/lib/catalog.ts` + `src/data/`)

The catalog has **two sources with one shape**. `catalog.ts` exposes async
accessors (`getProducts`, `getProductBySlug`, `getProductsByCollection`,
`getFeaturedProducts`, `getRelatedProducts`) that:

- read from **Postgres** when a database is configured (managed in the admin), or
- fall back to the **static seed** in `src/data/products.ts` when there's no DB.

Either way they return the same `Product` object, so storefront components don't
care where the data came from. `store.ts`, `collections.ts`, and `faqs.ts` remain
static config (brand, the 14 collections, FAQs) — collections are not yet
DB-managed.

- `store.ts` — brand name, tagline, **Scripture line**, contact, socials,
  shipping thresholds (`freeThreshold`, `flatRate`).
- `collections.ts` — 14 collections; each has a `slug`, `hue` (drives placeholder
  color), and optional `featured`. Product records reference a collection by slug.
- `products.ts` — the 116-product `seed[]` (imported from the live Threaded Hope
  Shopify shop), used to seed the DB on first deploy and as the runtime fallback.
  Slugs derive from the product name; each entry carries a real `image` URL
  (Threaded Hope Shopify CDN), falling back to a generated placeholder.

### Database (`prisma/schema.prisma`, `src/lib/db.ts`)

- Models: **Product** (catalog), **Order** (paid orders, JSON `items` snapshot),
  **Pageview** (traffic). `Product` has a primary `collectionSlug` plus a
  `collections` JSON list of every collection it appears in (see gotchas).
- `db.ts` creates the Prisma client **lazily** and only when a DB is configured
  (`isDbConfigured()` / `getPrisma()`), so no-DB builds and runs still work.
- Tables + seed are **auto-provisioned at build time** by `prisma/deploy.mjs`
  (`prisma db push` then `seed.ts`) whenever the DB env vars are present. Seeding
  is **one-time** — `seed.ts` skips when the catalog already has rows, so admin
  edits are never clobbered by a redeploy.

### Admin (`src/app/admin`)

- **Auth**: a single `ADMIN_PASSWORD` gates `/admin`. `lib/auth.ts` issues a
  signed session cookie (`jose`, HS256, key derived from the password via
  SHA-256 — no extra secret). `middleware.ts` verifies it on every `/admin/*`
  request except `/admin/login`.
- **Products**: create/edit/delete via server actions (`(panel)/products/
  actions.ts`) that write to Postgres and `revalidatePath` the storefront so
  changes appear immediately. Photo upload goes to **Vercel Blob** (public URLs).
- **Orders / Inventory / Discounts / Traffic**: see "Commerce model".

### Cart (`src/lib/cart-context.tsx`)

- Client-side React Context + `useReducer`, wrapped in `layout.tsx`.
- **Persisted to `localStorage`** (`threaded-hope-cart`), rehydrated on mount.
- Line identity = slug + a sorted signature of selected variant options.

### Payments & orders (Stripe Checkout, hosted)

- Flow: cart → `POST /api/checkout` builds a Checkout Session → hosted Stripe
  page → `/checkout/success` (cart clears). Card data never touches our server.
- Checkout enables **promo codes** (`allow_promotion_codes`) and tags each line
  item with the product `slug` in `price_data.product_data.metadata`.
- `api/webhooks/stripe` verifies `checkout.session.completed`, then **records an
  Order** (idempotent per session id) and **decrements tracked inventory** using
  the slug metadata, marking items sold out at 0.

## Commerce model

- **Stripe is still the authoritative record** for payments, receipts, and
  refunds. The app's `Order` table mirrors paid orders for the admin dashboard.
- Admin **Discounts** creates a Stripe coupon + promotion code; customers redeem
  the code at checkout.
- **Traffic**: `TrafficTracker` (client) beacons each storefront navigation to
  `/api/track`, which stores a `Pageview` (admin routes excluded). The admin
  Traffic page aggregates 24h / 7d / all-time counts and top pages.

## Gotchas / decisions

- **Server-side pricing is authoritative.** `api/checkout` re-looks-up each
  product via the catalog layer by slug and ignores any client price, so a
  tampered cart can't change the charge. It also skips out-of-stock items.
- **Per-variant pricing** (`lib/pricing.ts`). A product's `price` is the base
  (lowest); a variant may carry a `prices` map (a price-driving axis, e.g. size).
  `resolveUnitPrice(product, options)` is shared by the client (live price on the
  product page) and the server (the charged amount at checkout), so they always
  agree. `priceRange`/`hasVariablePricing` drive the "From $X" labels on cards
  and product pages. In the admin, per-option prices use `Size: S=13, M=14`
  syntax in the variants field.
- **Per-size stock** (`lib/stock.ts`). Stock can be tracked per size on the
  product's "size axis" (the price-driving variant, else a variant named like
  "size"), stored in `Product.sizeStock` (`{"S":5,"M":0}`). A size is sold out
  only when its count is an explicit 0 — a size with no entry is untracked
  (always available), so partial tracking never sells out a size by accident.
  `isAvailable`/`sizeSoldOut`/`defaultOption`/`computeInStock` are shared: the
  product page disables sold-out sizes and defaults to an in-stock one, checkout
  skips a sold-out size, and the webhook decrements the purchased size (passed in
  the line metadata). Edited per-size in the admin Inventory page; products
  without a size axis keep the single `stock` field. `checkout`/`success` skip
  applies; overall `inStock` is derived in the catalog layer.
- **Product images can be migrated off Shopify.** Freshly-seeded products hotlink
  the Threaded Hope Shopify CDN. `scripts/migrate-images.mjs` downloads each photo
  into Vercel Blob and rewrites `product.image` — idempotent, and requires a
  configured DB + `BLOB_READ_WRITE_TOKEN`. Load `.env.local` explicitly when
  running it locally (`node --env-file=.env.local scripts/migrate-images.mjs`);
  see SETUP.
- **Zero-config still works.** With no `DATABASE_*`/Blob/Stripe/admin env vars,
  the app builds and serves the static catalog; checkout returns HTTP 503 and the
  admin shows a "connect a database" notice. Each capability lights up when its
  env vars are present.
- **Catalog falls back to static when the DB is empty**, so the storefront is
  never blank if the DB exists but isn't seeded.
- **Lazy Stripe client** (`lib/stripe.ts`): reads `STRIPE_SECRET_KEY` at call
  time; only checkout/webhook/discounts require it.
- **Webhook needs the raw body** (`await req.text()`), returns 500 on DB failure
  so Stripe retries (order recording is idempotent). Both API routes are
  `runtime = "nodejs"` (Stripe SDK is not edge-safe).
- **ISR + revalidation.** Storefront catalog pages use `revalidate = 300`; admin
  mutations call `revalidatePath` for instant updates. Admin pages are
  `dynamic = "force-dynamic"`.
- **Admin chrome.** `ChromeGate` (client, `usePathname`) hides the storefront
  header/footer on `/admin` without opting storefront pages out of static
  rendering. The `(panel)` route group carries the admin sidebar; `/admin/login`
  sits outside it so it renders bare.
- **Product images.** Each product has an optional `image` rendered by
  `components/ProductImage.tsx`, falling back to a **generated SVG placeholder**
  (`lib/placeholder.ts`). Seeded products ship with a real photo URL and `seed.ts`
  writes `image`, so DB-backed catalogs keep their photos (moved to Vercel Blob by
  the migration above). The storefront renders plain `<img>` (also the brand logo
  below), so there are intentional `@next/next/no-img-element` lint **warnings**
  (not errors).
- **Brand logo & favicon.** The wordmark lives at `public/logo.png`, shown in the
  Header and Footer; `src/app/icon.png` + `apple-icon.png` supply the favicon and
  Apple touch icon via Next.js file-based metadata.
- **Products can belong to multiple collections.** A product has a primary
  `collection` (breadcrumb, hue, related) plus a `collections` list of every
  collection it appears in. `productsByCollection` / the DB query match any
  membership (`array_contains`), and the admin product form has an "Also list in"
  checkbox group. Existing rows with an empty `collections` fall back to the
  primary slug, so the column is safe to add via `prisma db push`.
- **Sold-out items sort last.** `lib/sort.ts` (`withInStockFirst` / `inStockFirst`)
  pushes out-of-stock products below in-stock ones on the shop, collections,
  gifting, home, and related lists — independent of the chosen sort. Stock hitting
  0 (via the webhook or an inventory edit) flips `inStock` to false.
- **Admin products & inventory are searchable/filterable.** The tables are client
  components (`AdminProductsTable`, `AdminInventoryTable`) fed by the server pages;
  they offer text search, a collection filter, a status filter, and sorting.
- **Home imagery is real, not placeholders.** `getCollectionImageOptions()`
  (catalog) yields distinct product photos per collection; the home page hands a
  unique one to every slot so nothing repeats. The header is a 3-column layout
  (nav · logo · search/cart) so the centered logo sits in-flow and can be enlarged
  (`h-16` mobile / `h-20` desktop, natural width) without distortion; it shows the
  logo alone (no wordmark text). The footer likewise shows just the logo.
- **Admin-managed home images.** `/admin/home` (`HomeImagesForm`) uploads the
  logo, the 4 hero-collage images, and the story image to Vercel Blob, stored in
  the `Setting` table. `lib/home-images.ts` (`unstable_cache`, tag `home-images`)
  reads them; the root layout passes the logo to Header/Footer and the home page
  applies the hero/story overrides — each falling back to its default. The logo
  upload is auto-trimmed with `sharp` so a transparent wordmark fills its box. The
  save action busts the cache with `revalidateTag(..., "max")` +
  `revalidatePath("/", "layout")`.
- **Instagram strip.** `lib/instagram.ts` fetches the latest 6 posts via the
  Instagram Graph API (hourly `revalidate`, so new posts surface and old ones drop
  off); it returns `[]` on missing/expired token and the home page falls back to
  recent product photos.
- **Self-refreshing Instagram token.** The active token is read from the DB
  (`Setting` table, `lib/settings.ts`), falling back to `INSTAGRAM_ACCESS_TOKEN`.
  A weekly Vercel Cron (`vercel.json` → `/api/cron/refresh-instagram`, guarded by
  `CRON_SECRET`) exchanges it for a fresh 60-day token and stores it, so it never
  lapses. The env var only bootstraps the first refresh.
- **Server-action body limit.** `next.config.ts` sets
  `serverActions.bodySizeLimit = "8mb"` so product photo uploads fit.
- **`package.json` is pinned for Vercel.** `name` is `threaded-hope`;
  `engines.node` is `22.x`. `build` runs `prisma generate && node
  prisma/deploy.mjs && next build`.
- **`vercel.json` forces the Next.js preset** (`{ "framework": "nextjs" }`) to
  avoid the *"No Output Directory named public"* failure. If it recurs, clear any
  `public` Output Directory override in Vercel → Settings → Build.
- **`metadataBase`** defaults to `https://threaded-hope.com`, overridable via
  `NEXT_PUBLIC_BASE_URL`.

## Environment variables

See [SETUP.md](./SETUP.md) for setup. Names only here:

- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Site** — `NEXT_PUBLIC_BASE_URL`
- **Database** (Neon via Vercel) — `DATABASE_POSTGRES_PRISMA_URL` (pooled, used by
  the app), `DATABASE_POSTGRES_URL_NON_POOLING` (direct, used for schema
  sync/seed), plus the other `DATABASE_*` vars the integration adds.
- **Blob** — `BLOB_READ_WRITE_TOKEN`
- **Admin** — `ADMIN_PASSWORD`
- **Instagram** — `INSTAGRAM_ACCESS_TOKEN` (bootstraps the home feed; then the
  self-refreshing DB copy is preferred), `CRON_SECRET` (guards the refresh cron)

Secrets live only in Vercel / `.env.local` (gitignored); `.env.example` is the
committed template. **Never commit real keys.**

## Accessibility

Semantic HTML, alt text, keyboard-navigable nav/cart/forms, skip link, visible
focus rings, WCAG-AA-minded contrast.
