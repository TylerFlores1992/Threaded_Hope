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
    collections/[slug]/          one page per collection (ISR)
    products/[slug]/             product detail (ISR, Product/Breadcrumb JSON-LD)
    blog/                        file-based "Journal" (list + [slug], Article JSON-LD)
    cart/                        cart page
    checkout/                    order review → Stripe redirect (+ gift option)
    checkout/success/            post-payment, clears cart
    sitemap.ts / robots.ts       dynamic sitemap + robots
    feed.xml/route.ts            Google Merchant Center product feed
    api/checkout/route.ts        creates Stripe Checkout Session (server)
    api/webhooks/stripe/route.ts records paid orders + decrements inventory
    api/track/route.ts           records storefront page views
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
                                 ProductGallery, JsonLd, ChromeGate, ThemeStyle,
                                 ThemePreviewBridge, TrafficTracker, admin/*
  data/                          store.ts, collections.ts, products.ts, faqs.ts,
                                 blog.ts (static seed + fallback catalog + blog)
  lib/                           cart-context, format, placeholder, stripe,
                                 db (Prisma), catalog (DB-or-static), pricing, auth,
                                 shipping (Shippo REST), packaging, stock, discounts,
                                 settings, email (Resend), seo (SITE_URL + keywords),
                                 site-text (+ -fields), theme (+ theme-config)
prisma/
  schema.prisma                  Product, Collection, Order, Pageview,
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
  shipping thresholds (`freeThreshold`, `flatRate`), and the `shipFrom` return
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
  root layout passes visible collections to the Header; the shop passes them to
  `ShopClient`. Deleting a collection is blocked while products still reference it.
- `products.ts` — the 116-product `seed[]` (imported from the live Threaded Hope
  Shopify shop), used to seed the DB on first deploy and as the runtime fallback.
  Slugs derive from the product name; each entry carries a real `image` URL
  (Threaded Hope Shopify CDN), falling back to a generated placeholder.

### Database (`prisma/schema.prisma`, `src/lib/db.ts`)

- Models: **Product** (catalog), **Collection** (categories, admin-managed),
  **Order** (paid orders, JSON `items` snapshot), **Pageview** (traffic),
  **DiscountRule** (automatic cart discounts), and **Setting** (key/value).
  `Product` has a primary `collectionSlug` plus a
  `collections` JSON list of every collection it appears in (see gotchas), a
  `weightOz` (per-unit shipping weight, used to prefill label parcels), and an
  `images` JSON array (gallery; `image` mirrors the primary `images[0]`). `Order`
  carries `labelUrl` / `trackingNumber` / `carrier` once a shipping label is
  bought, a receipt breakdown (`subtotalCents` / `discountCents` /
  `shippingCents` / `taxCents`, captured from Stripe in the webhook), gift fields
  (`isGift` / `giftMessage`), a `pickup` flag (local pickup chosen at
  checkout), `source` ("web" | "manual") + `notes` for sales recorded by hand,
  and fulfillment state (`fulfillmentStatus`
  unfulfilled|shipped|delivered, `shippedAt`, `deliveredAt`).
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
  the slug metadata, marking items sold out at 0 — the create + all decrements
  run in one `prisma.$transaction`, so a partial failure rolls back and Stripe's
  retry re-runs cleanly. Emails send after commit.

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
  page (logo, `store.contact` email + IG handle, ship-to, item/qty table, total,
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
  parcel. **Local-pickup orders** (`Order.pickup`, detected in the webhook from
  the chosen Stripe shipping option's display name) likewise hide all prices and
  render as a "Pickup Slip" with a pickup note instead of a ship-to address, so
  the slip handed to the customer at pickup carries no pricing.
- **Editable photos are consolidated** in the admin **"Photos"** tab
  (`/admin/home`, still that route). `HOME_IMAGE_SLOTS` drives both the uploader
  and the cached reader (`getHomeImages`); slots cover the logo, hero collage,
  home story image, and the **Our Story page image** (`our_story_image`). The
  save action busts the `home-images` tag and revalidates `/` and `/our-story`.
- **SEO.** `lib/seo.ts` centralizes `SITE_URL` (from `NEXT_PUBLIC_BASE_URL`) and a
  shared keyword list. Dynamic `app/sitemap.ts` (static pages + collections +
  products + blog, degrades to static-only if the DB is down) and `app/robots.ts`
  (disallow `/admin` `/checkout` `/cart` `/api`). JSON-LD via `components/JsonLd`:
  Store + WebSite site-wide (root layout), Product + BreadcrumbList on product
  pages, Article on blog posts. Metadata is keyword-rich + canonicalized with OG /
  Twitter cards. `scripts/seo-descriptions.ts` appends a keyword-aware, per-type,
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
- **Admin navigation** (`components/admin/AdminNav.tsx`). Grouped into Overview /
  Catalog / Sales / Storefront with an active-page highlight; the dashboard also
  carries quick-action shortcuts. The sidebar logo links to the storefront.
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
  shipped. When unset, everything runs as before with emails skipped.
- **Fulfillment status.** `Order.fulfillmentStatus` (unfulfilled → shipped →
  delivered). Buying a label auto-marks the order shipped (once) + emails
  tracking; the Orders table's `FulfillmentControl` (client) sets status inline
  via the `setFulfillment` action, which emails the customer on the first ship.
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
- **Product images & gallery.** Products carry an ordered `images` array (Blob
  URLs); `image` mirrors the primary (`images[0]`) for cards/cart. The product
  page renders `ProductGallery` (main photo + thumbnail strip); cards use
  `ProductImage`, both falling back to a **generated SVG placeholder**
  (`lib/placeholder.ts`). The admin product form manages the gallery — keep/remove
  existing photos (checkboxes, first = Main) + multi-upload; create/update persist
  the ordered list and set `image`. Photos are **portrait**, so **grid tiles use a
  4:5 `object-cover` frame** and the **detail image renders at natural height**
  (`h-auto`) — square/`object-cover` framing cropped them and square/`contain`
  left side bars. The storefront renders plain `<img>`, so there are intentional
  `@next/next/no-img-element` lint **warnings** (not errors).
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
- **Dashboard analytics.** Beyond the four stat tiles, the dashboard shows a
  **30-day daily revenue** bar chart (pure CSS, no chart lib) and a **best-sellers**
  list (units sold, last 90 days) aggregated from order item snapshots — both from
  a single 90-day order query.
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
- **Discreet admin link.** The footer copyright bar has a low-contrast `Admin`
  link (`rel="nofollow"`) for quick owner access; `/admin` is password-gated,
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

Secrets live only in Vercel / `.env.local` (gitignored); `.env.example` is the
committed template. **Never commit real keys.**

## Accessibility

Semantic HTML, alt text, keyboard-navigable nav/cart/forms, skip link, visible
focus rings, WCAG-AA-minded contrast.
