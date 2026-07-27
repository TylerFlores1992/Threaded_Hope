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

**Using the admin:** go to `/admin`, sign in with `ADMIN_PASSWORD`, then manage
Products (create/edit/delete with photo upload, including per-size/-unit stock and
shipping weight), Orders (with printable packing slips and Shippo shipping
labels — see below), Inventory, Discounts (Stripe promo codes), and Traffic.
Storefront pages revalidate automatically when you save, so changes appear within
moments.

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
(**Orders → Print**) work regardless.

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
  product editor) × quantity plus `store.shipping.packagingWeightOz`; if no
  product weights are set you enter it manually. Always verify before buying.
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

## Product images

The easiest way is the **admin**: edit a product at `/admin/products` and upload
a photo — it's stored in Vercel Blob and shown on the storefront. Products with
no photo use a generated SVG placeholder (`src/lib/placeholder.ts`, no network).

Editing the static seed in code still works too (for products without a DB, or to
change the starter catalog): each entry in `src/data/products.ts` accepts an
optional `image` URL, rendered by `src/components/ProductImage.tsx` with the
placeholder as fallback.
