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

Browsing, cart, and checkout *review* all work with **no configuration**.
Only the payment step needs Stripe keys (below).

## Environment variables

Copy the template and fill it in. **Never commit `.env.local` or real keys.**

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | For checkout | Stripe secret key. `sk_test_…` in dev, `sk_live_…` in production. From [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys). |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Signing secret (`whsec_…`) from `stripe listen` locally or a Dashboard webhook endpoint in production. |
| `NEXT_PUBLIC_BASE_URL` | Production | Canonical site URL, e.g. `https://threaded-hope.com`. Optional locally (defaults to the request origin; `metadataBase` falls back to the production domain). |

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
Add fulfillment side-effects in `src/app/api/webhooks/stripe/route.ts`
(marked `ADD FULFILLMENT HERE`).

## Deploy to production

Target host: **Vercel** (free Hobby tier; made by the Next.js team). Real
payments require a deployed server — the site cannot take live payments running
only on `localhost`.

### 1. Deploy the app

1. Ensure the code is on the **`main`** branch (Vercel deploys `main` as
   production by default). Merge the feature branch first if needed.
2. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**
   → import **`TylerFlores1992/Threaded_Hope`**. Next.js is auto-detected; click
   **Deploy**. You get a `…vercel.app` URL in ~2 minutes.
3. In **Project → Settings → Environment Variables**, add `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_BASE_URL=https://threaded-hope.com`.
   Redeploy so they take effect.

### 2. Connect the domain (threaded-hope.com — DNS at Cloudflare)

1. Vercel **Project → Settings → Domains** → add `threaded-hope.com` (and
   `www.threaded-hope.com`). Vercel shows the DNS records to create.
2. In the **Cloudflare** dashboard for the domain → **DNS → Records**, add what
   Vercel specifies — typically:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value `cname.vercel-dns.com`
   - **Cloudflare gotcha:** set these records to **DNS only (grey cloud)**, not
     proxied (orange cloud), so Vercel can issue/serve TLS. (If you keep the
     proxy on, set Cloudflare SSL/TLS mode to **Full**.)
3. Wait for DNS to propagate; Vercel auto-provisions HTTPS.

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

## Using your own product images

Placeholder images are generated SVGs (`src/lib/placeholder.ts`, no network).
To use real photos: drop files in `public/`, add an `image` field to products in
`src/data/products.ts`, and render it in `src/components/ProductImage.tsx`
(falling back to the placeholder when missing).
