# Setup & Deploy

How to run Threaded Hope locally, configure Stripe, and deploy to production.
For architecture, see [CONTEXT.md](./CONTEXT.md).

## Prerequisites

- **Node.js 18.18+** (developed on Node 22) and npm.
- Git.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build (prerenders pages)
npm run start      # serve the production build
npm run lint       # ESLint (expect only <img> warnings, no errors)
```

Browsing and cart work with **no configuration** (the app falls back to the
static catalog). Payments need Stripe keys; the admin, product management, and
order/inventory/traffic tracking need a database (and Blob for photos) — all below.

## Environment variables

Copy the template and fill it in. **Never commit `.env.local` or real keys.**

```bash
cp .env.example .env.local
```

| Variable | Required for | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Checkout | Stripe secret key. `sk_test_…` in dev, `sk_live_…` in production. From [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys). |
| `STRIPE_WEBHOOK_SECRET` | Orders/inventory | Signing secret (`whsec_…`) from `stripe listen` locally or a Dashboard webhook endpoint. Must match the mode (test/live) of the secret key. |
| `NEXT_PUBLIC_BASE_URL` | Production | Canonical site URL, e.g. `https://threaded-hope.com`. Optional locally. |
| `DATABASE_POSTGRES_PRISMA_URL` | Admin/catalog | Pooled Postgres URL used by the app (Neon). Added by the Vercel Neon integration. |
| `DATABASE_POSTGRES_URL_NON_POOLING` | Migrations | Direct Postgres URL used for schema sync + seed. Added by the integration. |
| `BLOB_READ_WRITE_TOKEN` | Photo upload | Vercel Blob read-write token for the product image uploader. |
| `ADMIN_PASSWORD` | Admin login | Password that gates `/admin`. Choose any strong value. |
| `SHIPPO_API_KEY` | Shipping labels (optional) | Shippo API token for buying/printing labels in the admin. `shippo_test_…` for free test labels, `shippo_live_…` for real postage. From [apps.goshippo.com/settings/api](https://apps.goshippo.com/settings/api). Absent → the label page shows a setup guide. |
| `RESEND_API_KEY` | Emails (optional) | Resend API key for order confirmation + shipping emails. Without it, emails are skipped and orders still record. From [resend.com](https://resend.com). |
| `EMAIL_FROM` | Emails (optional) | From address, e.g. `Threaded Hope <orders@threaded-hope.com>`. The sending domain must be verified in Resend; the mailbox itself need not exist (replies route to your contact email). |
| `STRIPE_TAX_ENABLED` | Sales tax (optional) | `1` turns on automatic Stripe Tax (exact per-destination, ~0.5%/order fee). Requires Stripe Tax configured (origin + registrations) first, or checkout errors. Mutually exclusive with the flat rate. |
| `STRIPE_TAX_RATE_ID` | Sales tax (optional) | A Stripe **Tax Rate** id (`txr_…`) for a free flat rate applied to items. Must be an **Exclusive** (added-on-top) rate in the same mode as your key. Ignored if `STRIPE_TAX_ENABLED=1`. |
| `NEXT_PUBLIC_SALES_TAX_RATE` | Sales tax (optional) | Percent (e.g. `7.25`) shown as a matching tax line in the on-site order summary. Build-time inlined — set it, then redeploy with a fresh build. Leave unset with automatic tax. |
| `INSTAGRAM_ACCESS_TOKEN` | Home IG strip | Long-lived Instagram Graph API user token. When set, the home page shows your latest 6 posts (auto-refreshing hourly); without it the strip falls back to recent product photos. |
| `CRON_SECRET` | IG token refresh | Random secret that authenticates the weekly token-refresh cron (`/api/cron/refresh-instagram`). Vercel Cron sends it as a Bearer token. Any strong random string. |

> The Neon integration adds several other `DATABASE_*` vars; only the two above
> are read by the app. Without any database vars the site still runs on the
> static catalog and `/admin` shows a "connect a database" notice.

Restart `npm run dev` after editing `.env.local`.

## Testing Stripe payments locally

1. Put your **test** secret key in `.env.local` (`STRIPE_SECRET_KEY=sk_test_…`).
2. Restart the dev server. Checkout now redirects to Stripe's hosted page.
3. Pay with test card **`4242 4242 4242 4242`**, any future expiry, any CVC, any
   ZIP. The order appears in your Stripe **test** Dashboard.

Optional — exercise the order webhook locally with the
[Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Paste the printed `whsec_…` into `.env.local` as `STRIPE_WEBHOOK_SECRET`.
On `checkout.session.completed`, the webhook records the order and decrements
tracked inventory (when a database is configured). It's idempotent per Stripe
session, so retries are safe.

## Database, Blob & admin

Product management, orders, inventory, discounts, and traffic run on a Postgres
database, Vercel Blob (photos), and an admin password. Set these up in Vercel:

1. **Postgres (Neon)** — Vercel → project → **Storage → Create Database → Neon
   Postgres**. Use the env-var prefix **`DATABASE`**. This adds
   `DATABASE_POSTGRES_PRISMA_URL`, `DATABASE_POSTGRES_URL_NON_POOLING`, and
   related vars to all environments.
2. **Blob** — Vercel → **Storage → Create → Blob**. Set **Access = Public**
   (product photos are shown publicly) and enable the **read-write token**, which
   adds `BLOB_READ_WRITE_TOKEN`.
3. **Admin password** — Settings → Environment Variables → add `ADMIN_PASSWORD`
   (Production + Preview).

On the next deploy, `prisma/deploy.mjs` runs `prisma db push` to create the
tables and seeds the 116 starter products **once** (it skips seeding if the
catalog already has rows, so it never overwrites admin edits).

**Using the admin:** go to `/admin` and sign in with `ADMIN_PASSWORD`. The nav is
grouped:

- **Overview** — Dashboard: stats, a 30-day revenue chart, best sellers, a
  read-only **Setup status** panel (which integrations are live/test), and
  quick-action shortcuts.
- **Catalog** — Products (create/edit/delete, photo gallery, per-size/-unit stock,
  shipping weight; plus **Sync from Shopify** for full descriptions/stock/weights),
  Collections, Inventory.
- **Sales** — Orders (packing slips, Shippo labels, CSV export, and **Record a
  sale** for orders made outside the website), Discounts, Traffic.
- **Storefront** — **Customize** (theme editor: sections, colors, fonts, layout,
  version history), **Site text** (all editable wording), **Photos** (logo, home
  imagery, Our Story image, and a banner per collection).

Storefront pages revalidate automatically when you save, so changes appear within
moments. A discreet **Admin** link in the site footer gives quick access; keep
`ADMIN_PASSWORD` strong since it also derives the admin session key.

To run the data scripts locally, first get the env vars into `.env.local`. The
easiest way is the Vercel CLI:

```bash
npm i -g vercel
vercel link                                    # select this project
vercel env pull .env.local --environment=production
```

> **Sensitive values pull back as `[SENSITIVE]`.** `vercel env pull` returns
> secrets (e.g. `BLOB_READ_WRITE_TOKEN`, `STRIPE_SECRET_KEY`, `ADMIN_PASSWORD`)
> as the literal placeholder `[SENSITIVE]`, not their real value. Copy the real
> ones from the Vercel dashboard and paste them into `.env.local` — the Blob
> token is shown on the **Storage → your Blob store** page (not under Settings →
> Environment Variables, which only shows `[Sensitive]`).

Unlike `npm run dev`, the standalone `seed.ts` and migration scripts (run via
`tsx`/`node`) do **not** auto-load `.env.local`, so pass it explicitly with
Node's `--env-file`. You usually don't need `db:push` locally — Vercel already
provisions the schema on deploy (`prisma/deploy.mjs`) — it's only for setting up
a brand-new empty database yourself.

```bash
# seed the 116 starter products (skips if the table already has rows)
node --env-file=.env.local --import tsx prisma/seed.ts
```

> **Already have old rows?** Seeding is one-time-guarded (it skips a non-empty
> catalog), so it won't refresh products already in the DB. To swap in the
> current catalog, clear the products table first, then re-seed. This is safe —
> orders keep their own item snapshots — but it **deletes all product rows**, so
> do it deliberately:
>
> ```bash
> node --env-file=.env.local -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); p.product.deleteMany().then(r=>{console.log("deleted",r.count);return p.$disconnect();});'
> node --env-file=.env.local --import tsx prisma/seed.ts
> ```

### Migrate product photos into Vercel Blob

The imported starter catalog references product photos on the Threaded Hope
Shopify CDN. To move them onto your own Vercel Blob store (so the storefront no
longer depends on Shopify), make sure `.env.local` has a **real**
`BLOB_READ_WRITE_TOKEN` (see the `[SENSITIVE]` note above) plus the `DATABASE_*`
URLs, then:

```bash
node --env-file=.env.local scripts/migrate-images.mjs --dry-run   # preview, no writes
node --env-file=.env.local scripts/migrate-images.mjs             # download → Blob → update DB
```

It only touches products still pointing at `cdn.shopify.com`, rewrites each to
its Blob URL, and is safe to re-run (already-migrated products are skipped). Run
it while the Shopify store is still up, since it pulls from Shopify's CDN. The
`migrate:images` npm script runs the same file, but you must load the env as
shown above.

### Re-import full product photos from Shopify (multiple per product)

Products support a photo **gallery** (`Product.images`; the first is the main
image). To (re)pull the **full-resolution originals — including multiple photos
per product — from each product's own Shopify page**, run the script (needs
`.env.local` with the DB + `BLOB_READ_WRITE_TOKEN`, and the Shopify store still
up). It matches products by title and pulls every image from the store's public
`/products.json`:

```bash
node --env-file=.env.local scripts/scrape-shopify-images.mjs --dry-run   # preview matches + counts
node --env-file=.env.local scripts/scrape-shopify-images.mjs             # download → Blob → save
```

Flags: `--only-missing` (only products with <2 photos), `--store <domain>`.

In the admin, edit a product to add/remove/reorder photos manually (first = main).
(An in-admin batch importer existed while the first import was pending; it was
removed after running.)

### Sync product details (descriptions, stock, weights) from Shopify

Pulls each product's **full description** (the original import kept only the
first sentences), **in/out-of-stock**, and **unit weight** from the live store,
matching by product name. Safe to re-run.

- **From a phone / no setup:** **Admin → Products → Sync from Shopify → Start
  sync.** Runs server-side in batches with a progress bar and lists anything that
  didn't match by name.
- **Locally:**

  ```bash
  node --env-file=.env.local scripts/sync-shopify-details.mjs --dry-run
  node --env-file=.env.local scripts/sync-shopify-details.mjs
  ```

  Flags: `--skip-stock`, `--skip-weight`, `--store <domain>`.

> ⚠️ Shopify's public data exposes only **whether** a variant is in stock, never
> the quantity — set real counts on the Inventory page. Weights improve the
> shipping-label parcel prefill.

### Backfill collection memberships

The static catalog (`src/data/products.ts`) carries each product's real
multi-collection membership. To apply it to an existing database (so products
show up in every collection they belong to), run — it updates the `collections`
field by slug and touches nothing else, so it's safe to re-run:

```bash
node --env-file=.env.local --import tsx scripts/backfill-collections.ts
```

### Clean emoji from product descriptions

Descriptions imported from Shopify can contain emoji. To strip them from the
descriptions already in the database (safe to re-run; only updates rows that
change):

```bash
node --env-file=.env.local --import tsx scripts/clean-descriptions.ts
```

### Enrich product descriptions for SEO

Give every product a keyword-relevant baseline description. The script appends a
short, product-type-aware sentence (bag / pouch / tote / keychain …, plus a
faith angle for faith-based items) — it never rewrites your copy, skips
already-enriched rows, and varies the wording by product so it isn't duplicate
text. Preview first, then apply:

```bash
node --env-file=.env.local --import tsx scripts/seo-descriptions.ts --dry-run
node --env-file=.env.local --import tsx scripts/seo-descriptions.ts
```

Fine-tune individual descriptions in the admin afterward.

### Blog / Journal

The blog lives in `src/data/blog.ts` (no CMS, no database). Add a post by
appending an entry to the `posts` array — `{ slug, title, excerpt, date,
keywords, body }`, where `body` is an array of `{ type: "p" | "h2" | "ul" }`
blocks. It appears on `/blog`, gets its own page with Article structured data,
and is added to the sitemap automatically.

### Customizing the storefront (no code)

Two admin tabs cover appearance and wording; both are safe to experiment with
since defaults reproduce the original design and nothing is public until saved.

- **Customize** (`/admin/customize`) — a theme editor with a live preview:
  - **Sections:** drag to reorder, show/hide, **add / duplicate / remove**
    (a type like "Shop by collection" can appear more than once), and open a
    section for its own settings *and* its wording.
  - **Theme:** color schemes or individual colors, heading/body font, heading
    size, corner style, page width.
  - **History:** restore any of the last 10 saved versions.
  - On a phone the editor toggles between **Edit** and **Preview**.
  - Colors/fonts/visibility preview instantly; section settings apply on **Save**
    (the preview reloads automatically).
- **Site text** (`/admin/text`) — every editable string across the home page, Our
  Story, and shop. **Clear a field to restore its original wording.**
- **Photos** (`/admin/home`) — logo, home hero images, story images, the Our Story
  photo, and a **banner per collection**.

### SEO checklist

Structured metadata, a dynamic `sitemap.xml`, `robots.txt`, and JSON-LD are
built in. The highest-impact manual step is to **submit the sitemap** in
[Google Search Console](https://search.google.com/search-console) (and Bing
Webmaster Tools): add `https://threaded-hope.com`, verify ownership, then submit
`https://threaded-hope.com/sitemap.xml`. Keep product titles/descriptions
specific and unique for the best results.

### Google Shopping (Merchant Center feed)

A product feed is served at **`/feed.xml`** (RSS 2.0 + Google's `g:` namespace)
for free Google Shopping listings. Products need a real hosted image to be
included, so re-import photos first (above). To use it: create a free
[Google Merchant Center](https://merchants.google.com) account, claim/verify the
site (it can reuse your Search Console verification), then **Products → Feeds →
Add** a scheduled fetch of `https://threaded-hope.com/feed.xml`. Google reviews
items over a few days before they can appear.

### Order emails (Resend, optional)

The store sends **order confirmation** (to the customer), a **new-order alert**
(to you), and a **shipping notification with tracking** (when an order ships).
All are optional — without `RESEND_API_KEY` they're simply skipped and orders
still record normally.

1. **Create a Resend account** at [resend.com](https://resend.com).
2. **Verify your sending domain.** Resend → **Domains → Add Domain** → enter your
   root domain (e.g. `threaded-hope.com`) so mail sends from `orders@` on it. It
   shows DNS records (a DKIM `TXT` on `resend._domainkey`, plus an MX and SPF
   `TXT` on a `send` subdomain, and an optional `_dmarc` TXT). Add each at your
   DNS host. These live on the `send` subdomain, so they **don't conflict with an
   existing mailbox provider** (e.g. Zoho) on the root domain — leave those
   records alone. Click **Verify**.
3. **Create an API key** (Resend → API Keys) and add it in Vercel as
   `RESEND_API_KEY`, plus `EMAIL_FROM` (e.g.
   `Threaded Hope <orders@threaded-hope.com>`). Redeploy.

The `from` mailbox doesn't need to exist — replies are routed to
`store.contact.email` via a reply-to header. Emails and fulfillment status:
buying a shipping label (or clicking **Mark shipped** on the Orders page)
flips the order to *Shipped* and emails the customer their tracking. Resend's
**Logs** tab shows every send with delivery status.

### Sales tax (optional)

Two ways to collect sales tax — pick one (or neither). Either way, tax is saved
on the order and appears on the receipt/slip, emails, CSV, and order-detail page.
You are responsible for being **registered** to collect (e.g. a CA seller's
permit from CDTFA) and for remitting — Stripe only calculates/charges.

- **Flat manual rate (free):** In Stripe → **Product catalog → Tax rates → +
  Create tax rate**, make a rate (e.g. `7.25`%) with **"Inclusive of tax"
  unchecked** (so it's **Exclusive** — added on top), in the **same mode as your
  API key** (Live for production). Copy its id (`txr_…`) into `STRIPE_TAX_RATE_ID`
  in Vercel and redeploy. Optionally set `NEXT_PUBLIC_SALES_TAX_RATE` to the same
  percent to show a matching line in the on-site summary (rebuild required, since
  `NEXT_PUBLIC_*` is inlined at build time). This charges the flat rate to every
  buyer regardless of address.
- **Automatic (Stripe Tax):** In Stripe → **Tax**, set your origin address,
  default category (General - Tangible Goods), and **registrations** (states you
  collect in). Then set `STRIPE_TAX_ENABLED=1` and redeploy. Exact
  per-destination rates; ~0.5%/order fee. Don't set the flat rate too.

> Gotchas learned in practice: a flat tax rate must be an **Exclusive** rate in
> the **live** mode (a test-mode or Inclusive rate breaks or mis-charges). The
> code validates the rate and skips it if invalid rather than failing checkout,
> but a wrong rate still means no/incorrect tax — verify with a test checkout and
> the dashboard **Setup status** panel (shows Auto / Flat rate / Off).

### Instagram feed (optional)

The home page shows your latest 6 Instagram posts when `INSTAGRAM_ACCESS_TOKEN`
is set; new posts appear and the oldest drops off automatically (it re-fetches
hourly). Without a token, the strip falls back to recent product photos — the
site never breaks on a missing or expired token.

To get a token you need an **Instagram Business or Creator account** and a Meta
app with **Instagram Graph API** access; generate a **long-lived user access
token** (~60 days) and add it as `INSTAGRAM_ACCESS_TOKEN` in Vercel.

**The token refreshes itself.** A Vercel Cron job (`vercel.json` →
`/api/cron/refresh-instagram`, weekly) exchanges the current token for a fresh
60-day one and stores it in the database (the `Setting` table), which the feed
prefers over the env var. So you paste the token **once**; after that it renews
automatically and never lapses (as long as the cron runs). To enable it, set a
**`CRON_SECRET`** env var in Vercel (any strong random string) — Vercel Cron
sends it as a Bearer token to authenticate the job. You can trigger a refresh
manually any time:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://threaded-hope.com/api/cron/refresh-instagram
```

If a refresh ever fails (e.g. the token fully expired first), just generate a new
one and update `INSTAGRAM_ACCESS_TOKEN` — the cron re-bootstraps from it.

### Shipping labels (Shippo, optional)

The admin can buy and print carrier labels per order (**Orders → Buy**). It's
optional — without a token the label page shows a setup guide, and packing slips
(**Orders → Print**) work regardless. The slip adapts to the order: a full
receipt for normal orders, and a **price-free slip** for gift orders (a "Gift
Receipt", with the gift message on its own page) and **local-pickup orders** (a
"Pickup Slip") so the customer's copy shows no pricing.

1. **Create a Shippo account** at [goshippo.com](https://goshippo.com)
   (pay-per-label, no monthly fee). Add a payment method under **Settings →
   Payment**.
2. **Copy an API token** from **Settings → Advanced → API**
   ([apps.goshippo.com/settings/api](https://apps.goshippo.com/settings/api)).
   Start with the **test** token (`shippo_test_…`, free fake labels); switch to
   the **live** token (`shippo_live_…`) when ready to buy real postage.
3. **Add it in Vercel** as `SHIPPO_API_KEY` (Production; Preview/Dev if wanted),
   then **redeploy** so it takes effect.
4. **Set your return address** in `src/data/store.ts` → `shipFrom` (name, street,
   city, state, zip, **phone**, email). This is the label sender.

Notes / gotchas learned in practice:

- **USPS requires both a sender phone and email** on `shipFrom` — a missing phone
  makes USPS purchases fail.
- **Non-USPS carriers (UPS, etc.) must be activated first** in the Shippo
  dashboard (**Settings → Carriers → Activate Account**). USPS works out of the
  box; buying an un-activated carrier's rate returns a "not yet registered" error.
- **Parcel weight** is prefilled from each product's **Weight (oz)** (set in the
  product editor) × quantity plus the selected **packaging preset** (manage
  presets at Orders → *Manage packaging*); if no product weights are set you enter
  it manually. Always verify before buying.
- **Test the flow before real orders exist:** while a `shippo_test_*` token is
  set, the Orders page shows a **"Create sample order"** button that inserts a
  realistic order to exercise labels + slips. It disappears on the live token.

## Deploy to production

Target host: **Vercel** (free Hobby tier; made by the Next.js team). Real
payments require a deployed server — the site cannot take live payments running
only on `localhost`.

### 1. Deploy the app

1. Ensure the code is on the **`main`** branch (Vercel deploys `main` as
   production by default). Merge the feature branch first if needed. *(The
   initial storefront is already merged to `main`.)*
2. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**
   → import **`TylerFlores1992/Threaded_Hope`**. Next.js is auto-detected; click
   **Deploy**. You get a `…vercel.app` URL in ~2 minutes.
   - **Framework Preset must be "Next.js", not "Other".** The committed
     `vercel.json` (`framework: nextjs`) sets this, but if a build ever fails
     with *"No Output Directory named public"*, check **Settings → Build &
     Deployment**: the preset is wrong (or a `public` Output Directory override
     is set) and needs clearing.
3. In **Project → Settings → Environment Variables**, add `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_BASE_URL=https://threaded-hope.com`.
   For the admin, also set up the database, Blob, and `ADMIN_PASSWORD` — see
   [Database, Blob & admin](#database-blob--admin). Redeploy so they take effect.

### 2. Connect the domain (threaded-hope.com — DNS at Cloudflare)

1. Vercel **Project → Settings → Domains** → add `threaded-hope.com` (and
   `www.threaded-hope.com`). Vercel shows the DNS records to create.
2. In the **Cloudflare** dashboard for the domain → **DNS → Records**, add what
   Vercel specifies — the working setup is:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value the per-project target Vercel shows (e.g.
     `<hash>.vercel-dns-017.com`; the legacy `cname.vercel-dns.com` also works)
   - **Cloudflare gotcha:** set these records to **DNS only (grey cloud)**, not
     proxied (orange cloud), so Vercel can issue/serve TLS. (If you keep the
     proxy on, set Cloudflare SSL/TLS mode to **Full**.)
   - **Leave the existing email records alone** — the zone already has Zoho
     `TXT`/DKIM records for mail; you're only *adding* the two web records above.
3. Wait for DNS to propagate; Vercel auto-provisions HTTPS. After the records go
   live, click **Refresh** on each domain in Vercel → Domains until it reads
   **Valid Configuration**. The `www` TLS certificate is issued a few minutes
   after `www` validates, so `www` may briefly serve a cert warning before the
   apex domain does.

> **Status:** `threaded-hope.com` is live over HTTPS; `www` redirects to it.

### 3. Go live with real payments

1. In Stripe, toggle to **live mode** and copy the **live** secret key
   (`sk_live_…`).
2. Update `STRIPE_SECRET_KEY` in Vercel to the live key.
3. Add a live webhook: Stripe **Dashboard → Developers → Webhooks → Add endpoint**
   → `https://threaded-hope.com/api/webhooks/stripe`, subscribe to
   `checkout.session.completed`. Copy its `whsec_…` into Vercel as
   `STRIPE_WEBHOOK_SECRET`. Redeploy.

> **Before flipping to live keys:** live mode means real cards, real money, and
> real orders to fulfill. Sales tax is the store owner's responsibility. It's
> safe to stay in test mode as long as you like.

### Going-live checklist

The admin **Dashboard → Setup status** panel shows each integration's mode
(green = live, amber = test, grey = not set) without exposing any secret — use it
to verify each step below. Redeploy after any env change.

- [ ] **Domain live** — `https://threaded-hope.com` serves over HTTPS; `www`
      redirects to it (see "Connect the domain").
- [ ] **Stripe key = Live** — `STRIPE_SECRET_KEY` is `sk_live_…`.
- [ ] **Stripe webhook (LIVE) set** — endpoint added in Stripe **live mode** →
      `…/api/webhooks/stripe`, event `checkout.session.completed`; its `whsec_…`
      is in `STRIPE_WEBHOOK_SECRET`. (A test-mode webhook secret with a live key
      means paid orders never record — the panel can't detect the mismatch, so
      double-check the endpoint was created in live mode.)
- [ ] **Place one real order** (you can refund it) and confirm: order appears in
      admin, confirmation + owner emails arrive, best-sellers/revenue update.
- [ ] **Shippo = Live** — swap `SHIPPO_API_KEY` to `shippo_live_…`. **Shippo
      gates live label purchases behind account verification:** add a payment
      method (Billing → Add Payment Method) and complete their Trust & Safety
      review *before* switching, or live label buys will fail. Keep the
      `shippo_test_…` token until they approve — packing slips work regardless.
- [ ] **Set the return address** — `src/data/store.ts` → `shipFrom` is your real
      address with a phone + email (USPS requires both).
- [ ] **Emails on** — `RESEND_API_KEY` + `EMAIL_FROM` set, sending domain verified
      in Resend (panel shows "On" + the from-address).
- [ ] **Sales tax (if collecting)** — a live Exclusive flat rate
      (`STRIPE_TAX_RATE_ID`) or automatic Stripe Tax (`STRIPE_TAX_ENABLED=1`) set,
      and you're registered to collect (e.g. CA seller's permit). Verify with a
      test checkout + Setup status.
- [ ] **Strong `ADMIN_PASSWORD`** — it also derives the admin session key.
- [ ] **Photos imported** — run the Shopify image import so products (and the
      Google feed) have real photos.
- [ ] **SEO** — sitemap submitted in Google Search Console; optionally submit the
      `/feed.xml` product feed in Google Merchant Center (after photos look good).

## Product images

The easiest way is the **admin**: edit a product at `/admin/products` and upload
a photo — it's stored in Vercel Blob and shown on the storefront. Products with
no photo use a generated SVG placeholder (`src/lib/placeholder.ts`, no network).

Editing the static seed in code still works too (for products without a DB, or to
change the starter catalog): each entry in `src/data/products.ts` accepts an
optional `image` URL, rendered by `src/components/ProductImage.tsx` with the
placeholder as fallback.
