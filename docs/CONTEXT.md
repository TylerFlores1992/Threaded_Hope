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
- **Shippo** (REST, no SDK) for buying + printing carrier shipping labels from
  the admin — optional, gated on `SHIPPO_API_KEY`.

## Architecture

```
src/
  app/
    page.tsx                     home
    shop/                        all products (client filter/sort/search)
    collections/                 collection index (photo tiles; home "View all")
    collections/[slug]/          one page per collection (ISR)
    products/[slug]/             product detail (ISR, Product/Breadcrumb JSON-LD)
    blog/                        file-based "Journal" (list + [slug], Article JSON-LD)
    cart/                        cart page
    checkout/                    order review → Stripe redirect (+ gift option)
    checkout/success/            post-payment, clears cart
    sitemap.ts / robots.ts       dynamic sitemap + robots
    opengraph-image.tsx          generated 1200×630 social card (site-wide default)
    error.tsx / not-found.tsx    runtime-error boundary + themed 404
    feed.xml/route.ts            Google Merchant Center product feed
    api/checkout/route.ts        creates Stripe Checkout Session (server)
    api/webhooks/stripe/route.ts records paid orders + decrements inventory
    api/track/route.ts           records storefront page views
    api/contact/route.ts         emails the shop owner from the contact form
    api/subscribe/route.ts       newsletter signup → Subscriber
    api/blob/upload/route.ts     admin-gated token issuer for direct Blob uploads
    admin/
      login/                     password login (bare, no admin chrome)
      actions.ts                 login / logout server actions
      (panel)/                   authenticated admin (shared sidebar layout)
        page.tsx                 dashboard (stats + revenue chart + best sellers)
        products/                list · new · [id]/edit (+ live inventory) · actions.ts
        products/sync/           pull full descriptions/stock/weights from Shopify
        orders/                  recorded orders (+ actions.ts: labels, sample order)
        orders/new/              record an off-site sale (manual order)
        orders/[id]/             order detail (items, totals, actions)
        orders/export/route.ts   CSV export of all orders
        orders/[id]/label/       buy + print a Shippo shipping label
        orders/packaging/        manage packaging presets (name + weight)
        orders/import/           import Shopify order history from a CSV export
        customers/               derived customer list + [email] detail
        collections/             list · new · [slug]/edit (photos, order, SEO)
        stripe/                  balance, payout schedule, recent payouts
        home/                    "Photos" tab — all editable non-product images
        text/                    "Site text" — editable storefront copy
        customize/               theme editor (sections, colors, fonts, history)
        inventory/               stock editing (+ actions.ts)
        discounts/               Stripe promo codes (+ actions.ts)
        traffic/                 page-view analytics
      orders/[id]/slip/          printable packing slip (outside (panel), no chrome)
    our-story/ gifting/ faqs/ contact/ shipping-returns/  content pages
    not-found.tsx                themed 404
  middleware.ts                  gates /admin/* on the session cookie
  components/                    Header, Footer, CartDrawer, ProductCard,
                                 ProductGallery, CollectionTile, JsonLd, ChromeGate,
                                 ThemeStyle, ThemePreviewBridge, TrafficTracker,
                                 ContactForm, admin/* (AdminTopBar, AdminNav,
                                 MetricsCard, RefundPanel, ProductPager, PayoutForm)
  data/                          store.ts, collections.ts, products.ts, faqs.ts,
                                 blog.ts (static seed + fallback catalog + blog)
  lib/                           cart-context, format, placeholder, stripe,
                                 db (Prisma), catalog (DB-or-static), pricing, auth,
                                 shipping (Shippo REST), packaging, stock, discounts,
                                 settings, email (Resend), seo (SITE_URL + keywords),
                                 site-text (+ -fields), theme (+ theme-config),
                                 customers (derived from orders + subscribers),
                                 date-range (dashboard ranges/bucketing),
                                 order-refunds, collection-sort,
                                 shopify (Admin API), shopify-csv (order export parser)
prisma/
  schema.prisma                  Product, Collection, Order, Pageview, Subscriber,
                                 DiscountRule, Setting models
  seed.ts                        one-time seed from the static catalog
  deploy.mjs                     build step: db push + seed when a DB exists
scripts/
  migrate-images.mjs             move product photos Shopify CDN → Vercel Blob
  backfill-collections.ts        apply static-catalog collection membership to DB
  seo-descriptions.ts            append keyword-aware SEO lines to descriptions
  scrape-shopify-images.mjs      re-pull full/multiple photos from Shopify → Blob
  sync-shopify-details.mjs       full descriptions + availability + weights
  clean-descriptions.ts          strip emoji from product descriptions in the DB
```

### Catalog data layer (`src/lib/catalog.ts` + `src/data/`)

The catalog has **two sources with one shape**. `catalog.ts` exposes async
accessors (`getProducts`, `getProductBySlug`, `getProductsByCollection`,
`getFeaturedProducts`, `getRelatedProducts`) that:

- read from **Postgres** when a database is configured (managed in the admin), or
- fall back to the **static seed** in `src/data/products.ts` when there's no DB.

Either way they return the same `Product` object, so storefront components don't
care where the data came from. `store.ts` and `faqs.ts` remain static config
(brand, FAQs). **Collections are now DB-managed** too, with the static list as
seed + fallback — see below.

- `store.ts` — brand name, tagline, **Scripture line**, contact, socials,
  shipping thresholds (`freeThreshold`, `flatRate` — the single source for the
  rate, read by the cart, the checkout summary, the Stripe session, the
  shipping-returns copy and manually recorded orders), and the `shipFrom` return
  address used as the label sender (name/street/city/state/zip/phone/email — edit
  before buying live labels; USPS requires both phone + email). Packaging weights
  are now presets in the DB (`lib/packaging.ts`), not in `store.ts`.
- `collections.ts` — the static collection list (14): `slug`, `name`,
  `description`, `hue`, optional `featured`/`hidden`. Seeds the DB `Collection`
  table on first deploy and is the runtime fallback. At runtime, collections are
  read through `lib/collections.ts` (`getVisibleCollections` / `getAllCollections`
  / `getCollectionBySlug` / `getCollectionMap`), which prefers the DB (managed at
  `/admin/collections` — add/edit/delete/hide) and falls back to this list.
  `catalog.ts` maps product `collectionSlug`→name/hue via `getCollectionMap`. The
  shop passes visible collections to `ShopClient`. The header no longer takes
  them: the mobile menu listed all fourteen, which buried everything else and
  made the menu scroll on a phone, so it's one **Collections** link to the index
  page — and the root layout stopped reading them at all. Deleting a collection is blocked while products still reference it.
- `products.ts` — the 116-product `seed[]` (imported from the live Threaded Hope
  Shopify shop), used to seed the DB on first deploy and as the runtime fallback.
  Slugs derive from the product name; each entry carries a real `image` URL
  (Threaded Hope Shopify CDN), falling back to a generated placeholder.

### Database (`prisma/schema.prisma`, `src/lib/db.ts`)

- Models: **Product** (catalog), **Collection** (categories, admin-managed),
  **Order** (paid orders, JSON `items` snapshot), **Pageview** (traffic),
  **Subscriber** (newsletter signups), **DiscountRule** (automatic cart
  discounts), and **Setting** (key/value).
  `Product` has a primary `collectionSlug` plus a
  `collections` JSON list of every collection it appears in (see gotchas), a
  `weightOz` (per-unit shipping weight, used to prefill label parcels), an
  `images` JSON array (gallery; `image` mirrors the primary `images[0]`),
  per-option stock (`optionStock`, alongside `sizeStock`), and Shopify-shaped
  merchandising fields (`status` active|draft|archived, `productType`, `vendor`,
  `collectionOrder`). `Collection` carries its own `heroImage` / `tileImage`,
  `sortMode`, and SEO overrides. `Order`
  carries `labelUrl` / `trackingNumber` / `carrier` once a shipping label is
  bought, a receipt breakdown (`subtotalCents` / `discountCents` /
  `shippingCents` / `taxCents`, captured from Stripe in the webhook) plus the
  `discountCode` used, gift fields
  (`isGift` / `giftMessage` / `giftFrom`), a `pickup` flag (local pickup chosen at
  checkout), `source` ("web" | "manual" | "shopify") + `notes` for sales recorded
  by hand or imported, the `phone` collected at checkout, refund state
  (`refundedCents` / `refundedAt` /
  `refundReason` / `restockedAt` — see "Refunds"), an `externalId` for imported
  orders, and fulfillment state (`fulfillmentStatus`
  unfulfilled|shipped|delivered, `shippedAt`, `deliveredAt`).
- **Schema changes must survive `prisma db push` on a populated table.** The
  build runs it *without* `--accept-data-loss` on purpose, so a change Postgres
  can't make in place fails the deploy rather than dropping data. Adding a
  `@unique` to a column that already has rows is the one that bites: `externalId`
  is indexed, not unique, for exactly this reason. Additive nullable/defaulted
  columns (all the refund fields) apply cleanly. Verify a migration against a
  table that *has rows* — an already-applied column makes push report "in sync"
  and proves nothing.
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
- **Reducer actions must return the same state object when nothing changed**, and
  every action is wrapped in a `useCallback` with empty deps. Returning a fresh
  object for an already-empty `clear` changed the state identity, which rebuilt
  the context value, which handed consumers a new `clear`, which an effect
  depending on `clear` then called again — an infinite loop that froze the
  checkout success page.
- **`hydrated` is set by the same dispatch that restores the items.** The success
  page waits for it before clearing, because a `clear()` that runs before
  rehydration is overwritten a moment later by the restored cart — every paying
  customer kept their full cart.

### Payments & orders (Stripe Checkout, hosted)

- Flow: cart → `POST /api/checkout` builds a Checkout Session → hosted Stripe
  page → `/checkout/success` (cart clears). Card data never touches our server.
- Checkout enables **promo codes** (`allow_promotion_codes`) and tags each line
  item with the product `slug` in `price_data.product_data.metadata`.
- `api/webhooks/stripe` verifies `checkout.session.completed`, then **records an
  Order** (idempotent per session id) and **decrements tracked inventory** using
  the slug metadata, marking items sold out at 0 — the create + all decrements
  run in one `prisma.$transaction`, so a partial failure rolls back and Stripe's
  retry re-runs cleanly. Emails send after commit.
- **The customer's name and address come from `collected_information.
  shipping_details`, not `customer_details`.** Checkout only collects a *shipping*
  address, so `customer_details.name` is usually null — the admin was showing a
  bare email where the name belongs — and `customer_details.address` is the
  *billing* address, which is the wrong one to put on a label. Both now prefer
  the collected shipping details, falling back to `customer_details` for older
  sessions. Orders saved before this fall back to the name stored on their
  address rather than showing an email.
- **The phone is kept.** `phone_number_collection` was on and the answer was
  discarded; `Order.phone` now stores it, shown on the order and customer pages
  as a `tel:` link and passed to Shippo as the recipient phone (some services
  require one). Only orders placed since carry it — Stripe doesn't backfill.

## Commerce model

- **Stripe is still the authoritative record** for payments, receipts, and
  refunds. The app's `Order` table mirrors paid orders for the admin dashboard.
- Admin **Discounts** has two kinds. **Promo codes** (manual): a Stripe coupon +
  promotion code the customer types at checkout. **Automatic discounts**
  (`DiscountRule`, `lib/discounts.ts`): quantity (buy N+) or spend (subtotal ≥ $)
  thresholds with a %/$ off, applied at checkout with no code. `api/checkout`
  evaluates the active rules against the cart (`pickBestRule`), and when one
  applies it creates a one-off Stripe coupon and passes it as the session
  `discounts`. **Stripe allows one discount per session**, so an auto discount
  and a typed code are mutually exclusive — the route sends `discounts` (auto) or
  `allow_promotion_codes` (manual), never both.
- **Traffic**: `TrafficTracker` (client) beacons each storefront navigation to
  `/api/track`, which stores a `Pageview` with its referrer (admin routes
  excluded). The admin Traffic page shows 24h / 7d / all-time counts, top pages,
  and **where visitors came from** — referrer hostnames rolled up into sources,
  with Instagram's several hostnames (`l.instagram.com` for the bio link,
  `instagram.com` from the in-app browser) counted as one and internal navigation
  dropped. That rollup groups by a **nullable** column, so it counts with
  `_count: { _all: true }`; counting the column itself skips the nulls, and the
  null group is direct traffic — the biggest bucket for taps from an app.

## Gotchas / decisions

- **Server-side pricing is authoritative.** `api/checkout` re-looks-up each
  product via the catalog layer by slug and ignores any client price, so a
  tampered cart can't change the charge. It also skips out-of-stock items.
- **Per-variant pricing** (`lib/pricing.ts`). A product's `price` is the base
  (lowest); a variant may carry a `prices` map (a price-driving axis, e.g. size).
  `resolveUnitPrice(product, options)` is shared by the client (live price on the
  product page) and the server (the charged amount at checkout), so they always
  agree. `priceRange`/`hasVariablePricing` drive the "From $X" labels on cards
  and product pages. In the admin, `ProductForm` builds variants with structured
  editors — a "comes in sizes" toggle with rows of size + optional price, and an
  "Other options" builder of named groups (color, etc.) each with value rows
  (serialized to the `otherOptions` JSON field). The size rows emit a `Size`
  variant (with a `prices` map when priced) — the price/stock axis.
- **`inStock` is derived, not a manual toggle.** The product form has no in-stock
  checkbox; availability comes from inventory. Unsized products follow their
  `stock` count (0 → sold out, blank → untracked/available); sized products get
  it from per-size counts, so a product edit never overwrites a size's sold-out
  state (only Inventory does).
- **Per-size stock** (`lib/stock.ts`). Stock can be tracked per size on the
  product's "size axis" (the price-driving variant, else a variant named like
  "size"), stored in `Product.sizeStock` (`{"S":5,"M":0}`). A size is sold out
  only when its count is an explicit 0 — a size with no entry is untracked
  (always available), so partial tracking never sells out a size by accident.
  `isAvailable`/`sizeSoldOut`/`defaultOption`/`computeInStock` are shared: the
  product page disables sold-out sizes and defaults to an in-stock one, checkout
  skips a sold-out size, and the webhook decrements the purchased size (passed in
  the line metadata). Edited per-size via the live inventory controls, now shown
  on **both** the Inventory page and the product edit page (`StockField` /
  `SizeStockField`, shared as the `ProductForm` `inventoryEditor` slot); because
  those write stock directly, `updateProduct` no longer touches `stock`/`inStock`.
  Products without a size axis keep the single `stock` field. `checkout`/`success` skip
  applies; overall `inStock` is derived in the catalog layer.
- **Fulfillment: packing slips + shipping labels.** Each recorded order has two
  admin tools. **Packing slip** (`/admin/orders/[id]/slip`) is a print-friendly
  page — it sets `@page { margin: 0 }` and supplies its own 0.5in print padding,
  because the browser's URL/date/page-number header-footer lives in the margin
  box and no property hides it (logo, `store.contact` email + IG handle, ship-to, item/qty table, total,
  thank-you + Scripture) — it lives *outside* the `(panel)` group so `ChromeGate`
  strips the admin sidebar for a clean print; a `print:hidden` toolbar/button
  triggers `window.print()`. **Buy label** (`/admin/orders/[id]/label`) uses
  Shippo: `lib/shipping.ts` is a dependency-free REST client (`createShipment` →
  live rates, `buyLabel` → PDF label + tracking), all gated on `SHIPPO_API_KEY`.
  The page is a stateless two-step — a GET parcel form puts dims in the query,
  the page fetches rates, and each rate's Buy is a server action
  (`purchaseLabel`) that persists `labelUrl`/`trackingNumber`/`carrier`. Parcel
  weight is prefilled from the ordered products' `weightOz` × qty plus the chosen
  **packaging preset** (see below), else left blank to force manual entry.
  Failures redirect back with a `buyError` banner rather than throwing (so Shippo
  messages are visible). Gotchas surfaced in testing: **non-USPS carriers (UPS, …)
  must be activated** in the Shippo dashboard first; **USPS requires both a sender
  phone and email** on `shipFrom`. When unconfigured the page shows a setup guide,
  and local-pickup / address-less orders are skipped. Test-mode-only **"Create
  sample order"** / **"Create sample gift order"** buttons (shown when the token
  is `shippo_test_*`, via `isShippoTestMode()`) insert realistic orders to
  exercise the flow before real orders exist; they auto-hide on the live token.
- **Packaging presets** (`lib/packaging.ts`). Named mailer/box presets (name +
  tare weight) stored as JSON in the `Setting` table, with sensible defaults when
  unset. Managed at `/admin/orders/packaging` (add/delete). On the buy-label page
  the `ParcelForm` (client) offers a packaging dropdown whose tare weight is added
  to the item weights to prefill the parcel weight, with a "Manage packaging"
  link beside it. Replaced the old fixed `store.shipping.packagingWeightOz`.
- **Packing slip doubles as a receipt / gift receipt / pickup slip.** Normal
  orders show a full breakdown (per-line price + amount, then subtotal / discount
  / shipping / total) from the `Order` receipt columns. **Gift orders**
  (`Order.isGift`, set from a checkout "This is a gift" option carried through
  Stripe session `metadata`) hide every price, and when a `giftMessage` was left
  it prints on its own page-break sheet as a decorative card to tuck in the
  parcel, signed `— from <giftFrom>` when the buyer filled the checkout "From"
  box (either field alone is enough to print the card). **Local-pickup orders** (`Order.pickup`, detected in the webhook from
  the chosen Stripe shipping option's display name) likewise hide all prices and
  render as a "Pickup Slip" with a pickup note instead of a ship-to address, so
  the slip handed to the customer at pickup carries no pricing.
- **Editable photos are consolidated** in the admin **"Photos"** tab
  (`/admin/home`, still that route). `HOME_IMAGE_SLOTS` drives both the uploader
  and the cached reader (`getHomeImages`), and each slot declares a `group` so
  the page is arranged by *where the photo appears*: Brand (logo), Home page
  ("Stitched with hope"), Our Story page, then one banner per collection. The
  save action busts the `home-images` tag and revalidates `/` and `/our-story`.
  **A slot must always be rendered somewhere.** Four "hero collage" slots
  outlived the collage they filled (removed in #75) and sat on this page for
  months accepting uploads that went nowhere — when a photo stops being shown,
  delete its slot in the same change. Their stored values were left in `Setting`,
  unused: a UI tidy-up shouldn't delete rows.
- **A collection's photos can be picked from its own products.** `SectionImageField`
  takes an optional `choices` list, rendered as a strip of thumbnails beside the
  file upload. The collection editor passes that collection's product photos,
  since that's where the right picture almost always is; the theme customizer
  uses the same component with no choices and is unchanged. Thumbnails go through
  the image optimizer — they're 48px squares over multi-MB originals.
- **SEO.** `lib/seo.ts` centralizes `SITE_URL` (from `NEXT_PUBLIC_BASE_URL`) and a
  shared keyword list. Dynamic `app/sitemap.ts` (static pages + collections +
  products + blog, degrades to static-only if the DB is down) and `app/robots.ts`
  (disallow `/admin` `/checkout` `/cart` `/api`). JSON-LD via `components/JsonLd`:
  Store + WebSite site-wide (root layout), Product + BreadcrumbList on product
  pages, Article on blog posts. Metadata is keyword-rich + canonicalized with OG /
  Twitter cards, and `app/opengraph-image.tsx` draws a branded 1200×630 social
  card as the site-wide default. **A page that declares its own `openGraph` block
  replaces the parent's images, including that file-convention one** — collection
  and blog pages therefore name an image explicitly, or a shared link previews
  with no picture at all. `scripts/seo-descriptions.ts` appends a keyword-aware, per-type,
  per-slug-varied sentence to product descriptions (non-destructive, idempotent).
- **Editable site copy** (`lib/site-text.ts` + `-fields.ts`). Every editable
  string is declared in `SITE_TEXT_FIELDS` with **its current copy as the
  default**, so nothing changes until edited. Overrides live per key in the
  `Setting` table (`text_<key>`) and are read through a cached `getSiteText()`
  (tag `site-text`). Clearing a field restores the default. Edit at
  `/admin/text`, or inside a section's panel in Customize. To make another
  string editable: add a field, then render `text.<key>`.
- **Theme customizer** (`/admin/customize`, `lib/theme.ts` + `theme-config.ts`).
  A Shopify-style editor: settings panel beside a live preview, with Save /
  Discard / Reset and a desktop/mobile width toggle.
  - **Storage.** The whole theme is one JSON blob in `Setting` (`theme`), read
    via a cached `getTheme()` (tag `site-theme`). Defaults reproduce the current
    design exactly, so an unconfigured site looks unchanged.
  - **Appearance.** `ThemeStyle` (in the root layout `<head>`) emits the theme as
    `:root` custom-property overrides — the tokens in `globals.css` already drive
    the whole site, so colors/fonts re-skin everything — plus a Google Fonts
    `<link>` for non-default fonts. Corner radius / page width / heading scale
    are extra vars consumed by rules in `globals.css`.
  - **Sections are placed instances**, not a fixed list: `layout: {key, type,
    settings, hidden}[]`, so a type can appear more than once (e.g. two
    collection rows). Add / duplicate / remove / drag-reorder in the panel;
    `HOME_SECTIONS` defines the types, `SECTION_SETTINGS` their per-instance
    settings, `ADDABLE_SECTIONS` which may repeat. The home page renders
    `theme.layout` in order, each wrapped in `[data-section]`. Older saved themes
    using `{sectionOrder, hiddenSections, sections}` are **upgraded on read** by
    `normalizeLayout`, so nothing breaks.
  - **Copy in the section panel.** `SECTION_TEXT_FIELDS` maps a section type to
    site-text keys, shown on the *first* instance of that type (those strings are
    global) and saved alongside the theme. Collection rows also take a
    per-instance `heading` override so duplicates can differ.
  - **Live preview.** `ThemePreviewBridge` runs only inside the editor iframe
    (`window.self !== window.top`, same-origin checked) and applies draft vars,
    fonts, and hidden sections over `postMessage`; it also scrolls to and flashes
    a section when one is selected. Colors/fonts/visibility update instantly;
    **section settings are server-rendered, so the preview reloads after Save**.
  - **Version history.** Each save/reset/restore snapshots the previous theme
    (last 10) under the `theme_history` setting; the History tab restores any of
    them (and snapshots first, so it's reversible). Timestamps come from the
    client — server render can't call `Date.now()` (lint forbids impure calls),
    which is also why new instance keys are derived from existing keys.
  - **Mobile.** Panel and preview can't sit side by side on a phone, so the
    editor switches between **Edit** and **Preview**; the container uses `svh`
    so browser chrome doesn't clip it.
- **Manual orders.** `/admin/orders/new` records a sale made off-site (in person,
  a fair, a friend): products with size/qty and an **editable price**, optional
  customer/shipping/note, saved as a paid order so it counts toward revenue and
  best-sellers. Optionally decrements inventory in the same transaction, and can
  be marked already handed over. Flagged `source = "manual"` (badge in the list,
  note on the detail page, columns in the CSV).
- **Collection banners.** Each collection has an admin-uploaded banner
  (`Setting` key `collection_hero_<slug>`, edited in the Photos tab), falling
  back to the generated pattern. The Photos save action is **key-driven** (it
  derives slots from the submitted fields) so these dynamic per-collection slots
  work alongside the static ones.
- **Admin chrome: top bar + sidebar.** `AdminTopBar` (client, `usePathname`)
  carries three things and nothing else — the shop logo (out to the *storefront*,
  not the dashboard), where you are, and that page's one primary action (Add
  product, Create order, Create collection). Sub-pages swap the location for a
  link back to their section, so the bar is also how you leave a product or an
  order. Routes map to labels/actions in one `ROUTES` table plus a few regexes for
  id-keyed detail pages; a page needs to know nothing about the bar, and list
  pages therefore **don't render their own `<h1>` or primary button**. The old
  Shopify-style global search and account chip are gone. `AdminNav` (sidebar) is a
  flat section list with sub-items revealed under the active section; Sign out
  sits at its foot. Under **Online Store** sit the storefront pages you edit —
  **Home page** (the theme customizer, `/admin/customize`), **Gifts**, **Site
  text**, **Photos**. "Customize" was renamed because the home page is all it
  edits.
- **Gift guides** (`lib/gifting.ts`, `/admin/gifts`, `GiftGuidesEditor`). The
  rows of products down `/gifting` are **placed instances**, the same shape the
  home page's sections use: a list you add to, remove from and reorder, stored as
  one JSON blob in `Setting` (`gifting_config`). Each guide carries its own
  heading, blurb and `limit` — with a variable number of guides there's nowhere
  fixed for Site text to keep them — and sources its products one of three ways:
  `collection` (stays current as products are added), `price` (a dollar ceiling,
  which follows your pricing), or `products` (hand-picked slugs, shown in the
  order chosen). The editor reports how many products each guide matches, so an
  empty guide is visible there rather than as a gap on the page; the page skips a
  guide that resolves to nothing.
  - **Site text keeps only the page-level copy** — title, subtitle, and the
    closing block. The old `text_gifting_guide*` fields are gone, but
    `defaultGuides()` reads those setting rows **directly** (not via
    `getSiteText`, which no longer declares them) so a shop that had renamed a
    guide keeps that wording on first load; after one save the stored guides are
    the whole truth. A config in an older shape parses to `null`, which selects
    the defaults rather than erroring.
  - The page once opened with a **"Shop gifts by recipient"** row of collection
    tiles. It was removed, along with everything that only fed it.
- **Refunds and returns** (`(panel)/orders/actions.ts` → `refundOrder`,
  `components/admin/RefundPanel.tsx`, `lib/order-refunds.ts`). Full or partial,
  from the order page. The amount defaults to the full remaining total and is
  re-validated server-side against `amountTotalCents - refundedCents`, so partials
  accumulate and can never exceed what was paid. `isStripeBackedOrder` decides
  what actually happens: a web order pays back through
  `stripe.refunds.create` on the session's payment intent, while manual sales
  and imported Shopify history have no Stripe payment behind them and are only
  *recorded* as refunded, with the UI saying so plainly. Stripe's own error text
  is passed through rather than reworded. Refunding optionally restocks the items
  (mirroring the webhook's decrement) — guarded by `restockedAt`, because
  otherwise two partial refunds each put the whole order back and the count climbs
  past what was ever sold. Either way the customer gets **our own refund
  confirmation email** (best-effort, after the books commit). Stripe sends a
  refund receipt too, but only in live mode and only if that email is enabled in
  the dashboard — which is why relying on it left refunded customers hearing
  nothing. Expect both mails when Stripe's is switched on.
- **Contact form** (`components/ContactForm.tsx` → `api/contact` →
  `sendContactMessage`). Emails the shop owner with the customer's address as
  reply-to. The thank-you only renders when the send actually succeeded; a failure
  says so and points at the shop's address. It shipped as a stub for a while —
  showing "we'll get back to you" while discarding the message — which is worth
  remembering as the failure mode to design against.
- **Customers** (`lib/customers.ts`, `/admin/customers`). Derived, not stored:
  orders are grouped by email and merged with `Subscriber` rows, so anyone who
  ordered *or* signed up appears, with order count, total spent (**net of
  refunds**), and first/last order dates. The detail page also shows their full
  shipping address and phone, taken from their most recent order that carried
  one — a snapshot, not something kept in sync if they move.
- **Stripe tab** (`/admin/stripe`). Balance (available / pending / instant),
  payout schedule, and recent payouts, plus a payout button **only when the
  account is on a manual schedule** — on the default automatic schedule Stripe
  moves the money itself and rejects manual payouts. Refunds, disputes and card
  details stay in the Stripe Dashboard, where Stripe can verify who you are.
- **Importing Shopify history.** Two paths, converging on one `Order.externalId`
  (`gid://shopify/Order/<id>`) so they can't duplicate each other.
  - **Admin API** (`lib/shopify.ts`): client-credentials grant against a custom
    app, token cached in memory and refreshed 5 minutes early. Used for product
    detail sync and customers.
  - **CSV export** (`lib/shopify-csv.ts` + `/admin/orders/import`): the only way
    to get orders older than **60 days** — the Admin API caps there without the
    `read_all_orders` scope, which Shopify grants by request. The export is **one
    row per line item**; continuation rows carry only `Name` + `Lineitem *`, so
    the parser groups by `Name` before building an order.
- **Images go through Next's optimizer.** Product photos are camera originals
  (~3000×4000, ~3 MB). Handing one to a 280px card left the browser to downscale
  ~10×, which Chrome does with a fast filter that visibly softens it — the same
  photo looked fine on the product page only because it's drawn large there.
  `ProductImage`, `ProductGallery`, `CollectionTile`, collection banners and the
  admin list thumbnails now render `next/image` with a `sizes` hint: measured,
  3,113,925 bytes → 33,669 for a card. `next.config.ts` `images.remotePatterns`
  allows the Blob host and `cdn.shopify.com` — **a new image host must be added
  there or its images 400**. Two traps: the files are named `.heic` but are JPEG
  inside (both hosts serve `image/jpeg`, which is what the optimizer checks), and
  the generated SVG placeholder is a data URI with nothing to optimize, so it
  stays a plain `<img>` — hence the remaining intentional
  `@next/next/no-img-element` lint **warnings**.
- **Product editor pager** (`components/admin/ProductPager.tsx`). Previous/next
  arrows with a position count, so a run of edits doesn't mean a trip back to the
  list. Deliberately server-rendered from a fixed order (newest first) rather than
  following the list's current sort: reading that from the browser rendered the
  arrows one way on the server and another on the client, which React reports as a
  hydration mismatch. Passing the sort through the URL would be the safe way to
  personalise it.
- **Large uploads bypass server actions.** Vercel caps a serverless request body
  at ~4.5 MB regardless of `serverActions.bodySizeLimit`, which is why photo
  uploads failed with "page couldn't load". Photos now upload **client-side
  straight to Blob** (`@vercel/blob/client` `upload()`), with
  `api/blob/upload/route.ts` issuing the token. That route authenticates **only**
  the `blob.generate-client-token` call — Vercel's completion callback arrives
  without a cookie, so gating it too would reject every finished upload.
- **Home page composition.** The home page builds a `renderers` map keyed by
  section type (each taking that instance's settings) and renders
  `theme.layout`. Collection tiles fill from featured collections first, then
  top up from the rest, so the grid always fills its configured tile count.
- **Blog ("Journal").** File-based in `src/data/blog.ts` (structured blocks, no
  markdown lib). `/blog` list + `/blog/[slug]` posts (statically generated),
  linked from the footer and the sitemap. Add a post by appending to the array.
- **Transactional email** (`lib/email.ts`). Dependency-free **Resend** REST
  client with branded, inline-styled HTML templates, gated on `RESEND_API_KEY`
  (from `EMAIL_FROM`; reply-to is `store.contact.email`). Sends are **best-effort
  and never throw into the order flow** — a mail failure must not 500 the webhook
  (Stripe would retry and double-process). The webhook sends an **order
  confirmation** (customer) + **new-order alert** (owner) after recording; a
  **shipping notification** with tracking goes out when an order first becomes
  shipped; refunding an order emails a **refund confirmation**. When unset, everything runs as before with emails skipped.
- **Fulfillment status.** `Order.fulfillmentStatus` (unfulfilled → shipped →
  delivered). Buying a label auto-marks the order shipped (once) + emails
  tracking; the Orders table's `FulfillmentControl` (client) sets status inline
  via the `setFulfillment` action, which emails the customer on the first ship.
  **A fully refunded order is not a parcel waiting to go out** — `needsFulfilment`
  (`lib/order-refunds.ts`) is shared by the dashboard's "To ship" count, the
  Orders "To fulfill" stat and the Unfulfilled tab so they can't drift, and the
  control reads "Refunded" with no actions. Two cases deliberately excluded: a
  *partial* refund still needs sending (refunding shipping, or one item of three,
  leaves a parcel), and an order refunded *after* shipping keeps showing
  "Shipped" — once it's gone out, what happened to the money is a separate story.
  The dashboard count compares `refundedCents` to `amountTotalCents` as a Prisma
  **field reference**, so the database does it rather than loading every
  unfulfilled order into memory.
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
- **The root layout must not be able to throw.** `error.tsx` catches a failing
  *page*, but nothing catches a failing *layout* — and the root layout reads the
  database three times (home images, nav collections, theme). Each read falls back
  instead (bundled logo, no nav dropdown, default theme), so a database hiccup
  degrades the shop rather than white-screening every page at once.
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
- **Product images & gallery.** Products carry an ordered `images` array (Blob
  URLs); `image` mirrors the primary (`images[0]`) for cards/cart. The product
  page renders `ProductGallery` (main photo + thumbnail strip); cards use
  `ProductImage`, both falling back to a **generated SVG placeholder**
  (`lib/placeholder.ts`). The admin product form manages the gallery — keep/remove
  existing photos (checkboxes, first = Main) + multi-upload; create/update persist
  the ordered list and set `image`. Photos are **portrait**, so **grid tiles use a
  4:5 `object-cover` frame** and the **detail image renders at natural height**
  (`h-auto`) — square/`object-cover` framing cropped them and square/`contain`
  left side bars. Real photos render through `next/image` (see "Images go through
  Next's optimizer"); only the generated SVG placeholder stays a plain `<img>`,
  which is where the intentional `@next/next/no-img-element` lint **warnings**
  (not errors) come from.
- **Re-import from Shopify.** Two things are pulled from the live store's public
  `/products.json`, both matching products by title:
  - **Photos** — `scripts/scrape-shopify-images.mjs` writes full-res multi-image
    galleries to `Product.images` (needs local DB + Blob env).
  - **Details** — full descriptions (`body_html` → clean text with paragraphs and
    bullets), in/out-of-stock, and unit weight (grams → oz). Available both as
    `scripts/sync-shopify-details.mjs` and, so it can be run from a phone, as an
    in-admin page at **`/admin/products/sync`** that batches the same work
    server-side. Product descriptions render with `whitespace-pre-line`.
  - ⚠️ **Shopify's public feed has no stock quantities** — only `available`
    true/false per variant. Counts require Admin API credentials; set them in the
    Inventory page instead.
- **Google Merchant feed.** `app/feed.xml/route.ts` emits an RSS 2.0 + `g:`
  product feed (id/title/price/availability/brand + gallery images) for free
  Google Shopping listings. Products without a real hosted image are skipped.
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
  they offer text search, a collection filter, a status filter, and sorting. The
  products table shows a per-row **photo thumbnail** and **persists its filters**
  across navigation via `sessionStorage` (returning from an edit keeps them). The
  low-stock *filter option* was removed; the dashboard's old "Low stock" stat is
  now **"To ship"** (count of `fulfillmentStatus = "unfulfilled"` orders).
- **Dashboard analytics.** `MetricsCard` (client) draws a hand-rolled
  cardinal-spline SVG chart with a selectable metric (sales, orders, sessions,
  conversion rate) and a same-length previous-period comparison, over a range
  picked in `RangePicker` — 7d / 30d / 90d / 6m / 12m / YTD / last year
  (`lib/date-range.ts` resolves the range and buckets by day or month, UTC-safe).
  Alongside it: four stat tiles and a **best-sellers** list (units sold, 90 days)
  from order item snapshots. **Revenue is net of refunds** everywhere — the
  all-time tile and every chart bucket subtract `refundedCents`, booked against
  the order's own date so the chart keeps matching the order list.
  Two things learned the hard way here: the SVG needs an explicit `viewBox` with
  room for its axis labels (it letterboxed into half the card without one), and
  an SVG `<title>` must take **one** interpolated string — React separates
  adjacent text nodes with marker comments, the browser reunites them inside
  `<title>`, and the mismatch made React throw the whole chart away and re-render
  it on every load.
- **CSV order export.** `GET /admin/orders/export` (route handler under `/admin`,
  so middleware-gated) streams a downloadable CSV of all orders with proper
  quoting. Linked from the Orders page.
- **Order-detail page.** `/admin/orders/[id]` consolidates one order — fulfillment
  control, gift/pickup flags + gift message, quick actions (packing slip,
  buy/view label), customer + shipping (or pickup) with tracking, and an itemized
  totals breakdown (subtotal / discount / shipping / tax / total). Orders-list
  rows link to it via the customer name.
- **Sales tax — two modes (pick one), or off.** Captured as `Order.taxCents`
  (from `total_details.amount_tax`) and shown on the slip/receipt, emails, CSV,
  and order-detail page.
  - **Automatic (Stripe Tax):** `STRIPE_TAX_ENABLED=1` sets `automatic_tax` +
    line/shipping `tax_behavior: "exclusive"` + a general-goods `tax_code`. Exact
    per-destination, ~0.5%/order fee. Off by default because `automatic_tax`
    errors if Stripe Tax isn't configured (origin + registrations).
  - **Flat manual rate (free):** `STRIPE_TAX_RATE_ID=txr_…` applies a single
    Stripe Tax Rate to line items — no per-order fee. **Must be an Exclusive**
    (added-on-top) rate in the **live** mode matching the key. Two gotchas that
    broke checkout in practice and are now guarded: a test-mode/invalid rate id
    is validated via `taxRates.retrieve` and skipped (never breaks checkout); and
    `tax_behavior` is set **only** for automatic tax, since combining it with a
    manual `tax_rate` conflicts and errors the session.
  - **On-site tax line:** `NEXT_PUBLIC_SALES_TAX_RATE` (e.g. `7.25`, build-time
    inlined) shows a matching "Sales tax (X%)" line in the checkout summary so the
    on-site total equals the Stripe total; unset keeps the "calculated at
    checkout" note (correct for automatic tax, which varies by address).
- **Admin config health.** The dashboard's **Setup status** panel reads env
  prefixes server-side and shows each integration's *mode only* (never the
  secret): Stripe Live/Test, webhook Set, Shippo Live/Test, email On, and sales
  tax Auto/Flat/Off. Used to verify live-vs-test at a glance.
- **Shop search is URL-driven.** `/shop?q=…` filters on landing (feeds the SEO
  `SearchAction`); `ShopClient` also writes the query back to the URL as you type
  (debounced, `history.replaceState` — no server round-trip) so searches are
  shareable.
- **Discreet admin link.** The footer copyright bar has a small `Admin`
  link (`rel="nofollow"`) for quick owner access — underlined and at full
  `ink-soft`, since a faded link inside a line of text failed contrast twice over;
  `/admin` is password-gated,
  sitemap-excluded, and robots-disallowed, so exposing it is low-risk.
- **Input-hardening (money paths).** Emails HTML-escape all customer-controlled
  fields before interpolation (no injection into confirmation/owner mail).
  Checkout rejects a submitted size that isn't one of the product's real
  size-axis options. `purchaseLabel` short-circuits if the order already has a
  label so a re-submit can't buy a second (paid) Shippo label. **Note:** the admin
  session key is `SHA-256(ADMIN_PASSWORD)`, so use a high-entropy password; and
  there is no hard stock reservation between checkout and payment (acceptable for
  low volume — two buyers could both pay for the last unit).
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
- **Shipping (optional)** — `SHIPPO_API_KEY` (`shippo_test_*` or `shippo_live_*`);
  enables buying labels in the admin. Absent → the label page shows a setup guide.
- **Email (optional)** — `RESEND_API_KEY` and `EMAIL_FROM` (e.g.
  `Threaded Hope <orders@threaded-hope.com>`); enables order/shipping emails.
  Absent → emails are skipped, orders still record.
- **Sales tax (optional, pick one)** — `STRIPE_TAX_ENABLED=1` (automatic Stripe
  Tax) **or** `STRIPE_TAX_RATE_ID=txr_…` (free flat rate). Plus
  `NEXT_PUBLIC_SALES_TAX_RATE` (e.g. `7.25`) to show a matching on-site tax line
  (build-time inlined — needs a rebuild to change).
- **Instagram** — `INSTAGRAM_ACCESS_TOKEN` (bootstraps the home feed; then the
  self-refreshing DB copy is preferred), `CRON_SECRET` (guards the refresh cron)
- **Shopify import (optional)** — `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`,
  `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION`. Read by `lib/shopify.ts` for the
  product-detail sync and customer import. Absent → those admin pages show a setup
  note; the CSV order import needs none of them.

Secrets live only in Vercel / `.env.local` (gitignored); `.env.example` is the
committed template. **Never commit real keys.**

## Accessibility

Audited with **axe** against WCAG 2.1 A + AA across twelve storefront pages plus
the 404; all report **zero violations**, alongside a manual keyboard pass. What
that rests on, and what to preserve when changing things:

- Semantic HTML, alt text on every product photo, `alt="" aria-hidden` on
  decorative imagery, a skip link as the first tab stop, visible focus rings, and
  a label on every form field.
- **The cart drawer is `inert` while closed.** `aria-hidden` alone hides it from
  screen readers but leaves its buttons in the tab order — 47 tabs down the home
  page used to land on an invisible "Close cart". Opening it moves focus to the
  close button and closing hands focus back to whatever opened it.
- **Contrast is checked against `--sand`**, the darker of the two page grounds.
  The primary green is `#4f6a4d` (4.97:1 as text, 6.0:1 for white on top); the
  previous `#5f7a5d` measured 3.93:1 and failed. The **hover** green darkens
  rather than lightens — lightening put white button labels at 3.05:1, a failure
  axe won't catch because it only tests the default state.
- **A saved theme keeps whatever it stored**, so raising the defaults alone would
  leave any shop that opened the theme editor once still serving the old colours.
  `mergeTheme` swaps the two superseded values on read (`SUPERSEDED_COLORS`) and
  leaves every colour actually chosen alone. The theme editor still accepts any
  colour, so **it can reintroduce a contrast failure** — that's the one live hole.
- **Links inside a line of text carry an underline**, so they don't depend on
  colour alone.

Caveat worth keeping in mind: automated tools catch roughly a third to a half of
real accessibility problems. They can confirm alt text exists, not that it says
anything useful.
