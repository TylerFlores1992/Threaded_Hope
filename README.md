# Threaded Hope

A warm, faith-inspired ecommerce storefront for a small handmade fabric-goods
shop. Built with **Next.js (App Router) · React · TypeScript · Tailwind CSS**.

Everything is stubbed to run locally out of the box — placeholder products,
generated placeholder images, a client-side cart that persists across refreshes,
and a working multi-step checkout with a clearly-marked **mock** payment step.

---

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (prerenders all pages)
npm run start    # serve the production build
npm run lint     # ESLint
```

Requires Node 18.18+ (developed on Node 22).

---

## Where to edit content & branding

All editable content lives in **`src/data/`** — no need to touch components:

| File | What it controls |
| --- | --- |
| `src/data/store.ts` | Store name, tagline, **Scripture line**, contact info, socials, shipping thresholds |
| `src/data/collections.ts` | Collection names, slugs, descriptions, accent color (`hue`) |
| `src/data/products.ts` | The full product catalog — names, prices, descriptions, variants, stock |
| `src/data/faqs.ts` | FAQ questions & answers |

**Colors & fonts:** design tokens are CSS variables at the top of
`src/app/globals.css` (the warm-neutral palette, sage/gold accents). Fonts are
set in `src/app/layout.tsx` (Fraunces for headings, Nunito Sans for body).

### Adding a product

Add an object to the `seed` array in `src/data/products.ts`:

```ts
{
  collection: "bags-pouches",          // must match a slug in collections.ts
  name: "My New Pouch",
  price: 18,
  description: "A short, friendly blurb.",
  variants: [COLOR],                    // optional; COLOR / PATTERN presets provided
  inStock: true,                        // optional (defaults true)
  featured: true,                       // optional — shows on the home page
}
```

The URL `slug` and placeholder image are generated automatically from the name.

---

## Using your own images

Placeholder images are generated as inline SVGs by
`src/lib/placeholder.ts` — no network calls, and they look consistent out of the
box. To use real photos:

1. Drop images in `public/` (e.g. `public/products/my-pouch.jpg`).
2. Add an `image` field to your products in `products.ts`.
3. Update `src/components/ProductImage.tsx` to render that `image` (optionally
   swapping the `<img>` for `next/image`) and fall back to the placeholder when
   it's missing.

---

## Plugging in real payments (Stripe)

The checkout (`src/app/checkout/page.tsx`) is intentionally a **mock**. The
payment step is clearly labeled "Demo mode" and no card data leaves the browser.
The single integration point is the `placeOrder()` function.

To go live with Stripe:

1. `npm install stripe @stripe/stripe-js`
2. Create a route handler (e.g. `src/app/api/checkout/route.ts`) that builds a
   Stripe Checkout Session or PaymentIntent from the cart items on the server.
3. In `placeOrder()`, call that endpoint and redirect to Stripe Checkout (or
   confirm the PaymentIntent with Stripe Elements), then clear the cart on
   success. Replace the mock card fields with Stripe Elements.
4. Add a webhook handler to fulfill orders once payment is confirmed.

Because product data comes from a simple data layer, you can also swap
`src/data/products.ts` for a real backend or the Shopify Storefront API later
without touching the UI.

---

## Project structure

```
src/
  app/                     # routes (App Router)
    page.tsx               # home
    shop/                  # all products (filter + sort + search)
    collections/[slug]/    # one page per collection
    products/[slug]/       # product detail
    cart/  checkout/       # cart page + multi-step checkout
    our-story/ gifting/ faqs/ contact/ shipping-returns/
  components/              # reusable UI (Header, Footer, CartDrawer, cards…)
  data/                    # ← edit content here
  lib/                     # cart state, price formatting, image placeholder
```

## Accessibility

Semantic HTML, alt text on imagery, keyboard-navigable nav/cart/forms, a skip
link, visible focus rings, and WCAG-AA-minded contrast throughout.
