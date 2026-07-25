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
Products (create/edit/delete with photo upload), Orders, Inventory, Discounts
(Stripe promo codes), and Traffic. Storefront pages revalidate automatically when
you save, so changes appear within moments.

To work against the database locally, put the same `DATABASE_*` values in
`.env.local`, then:

```bash
npm run db:push   # create/sync tables
npm run db:seed   # seed the 116 starter products (skips if non-empty)
```

### Migrate product photos into Vercel Blob

The imported starter catalog references product photos on the Threaded Hope
Shopify CDN. To move them onto your own Vercel Blob store (so the storefront no
longer depends on Shopify), configure the database **and** `BLOB_READ_WRITE_TOKEN`,
then run:

```bash
npm run migrate:images            # download from Shopify → upload to Blob → update DB
npm run migrate:images -- --dry-run   # preview what would change, no writes
```

It only touches products still pointing at `cdn.shopify.com`, rewrites each to
its new Blob URL, and is safe to re-run (already-migrated products are skipped).

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
