"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The admin's top bar.
 *
 * It carries three things and nothing else: your logo (out to the storefront),
 * where you are, and the one action this page is for. Sub-pages swap the
 * location for a link back to the section they belong to, so the bar is also
 * how you get out of a product or an order.
 *
 * Routes are matched longest-first, so `/admin/products/new` wins over
 * `/admin/products`.
 */
type Entry = {
  /** Section name, or the label of the page when it's a sub-page. */
  label: string;
  /** Sub-pages link back to their section from the bar. */
  back?: { href: string; label: string };
  /** The page's primary action, when it has one. */
  action?: { href: string; label: string };
};

const ROUTES: [string, Entry][] = [
  ["/admin/products/new", { label: "New product", back: { href: "/admin/products", label: "Products" } }],
  ["/admin/products/sync", { label: "Sync", back: { href: "/admin/products", label: "Products" } }],
  ["/admin/products", { label: "Products", action: { href: "/admin/products/new", label: "Add product" } }],
  ["/admin/orders/new", { label: "Record a sale", back: { href: "/admin/orders", label: "Orders" } }],
  ["/admin/orders/import", { label: "Import from Shopify", back: { href: "/admin/orders", label: "Orders" } }],
  ["/admin/orders/packaging", { label: "Packaging", back: { href: "/admin/orders", label: "Orders" } }],
  ["/admin/orders", { label: "Orders", action: { href: "/admin/orders/new", label: "Create order" } }],
  ["/admin/collections/new", { label: "New collection", back: { href: "/admin/collections", label: "Collections" } }],
  ["/admin/collections", { label: "Collections", action: { href: "/admin/collections/new", label: "Create collection" } }],
  ["/admin/inventory", { label: "Inventory" }],
  ["/admin/customers", { label: "Customers" }],
  ["/admin/discounts", { label: "Discounts" }],
  ["/admin/stripe", { label: "Stripe" }],
  ["/admin/traffic", { label: "Analytics" }],
  ["/admin/customize", { label: "Customize" }],
  ["/admin/text", { label: "Site text" }],
  ["/admin/home", { label: "Photos" }],
  ["/admin/search", { label: "Search" }],
  ["/admin", { label: "Home" }],
];

/** Detail pages are keyed by id, so they're matched by shape rather than exactly. */
function entryFor(pathname: string): Entry {
  if (/^\/admin\/products\/[^/]+\/edit\/?$/.test(pathname)) {
    return { label: "Edit product", back: { href: "/admin/products", label: "Products" } };
  }
  if (/^\/admin\/orders\/[^/]+\/label\/?$/.test(pathname)) {
    return { label: "Shipping label", back: { href: "/admin/orders", label: "Orders" } };
  }
  if (/^\/admin\/orders\/[^/]+\/?$/.test(pathname)) {
    return { label: "Order", back: { href: "/admin/orders", label: "Orders" } };
  }
  if (/^\/admin\/customers\/[^/]+\/?$/.test(pathname)) {
    return { label: "Customer", back: { href: "/admin/customers", label: "Customers" } };
  }
  if (/^\/admin\/collections\/[^/]+/.test(pathname)) {
    return { label: "Collection", back: { href: "/admin/collections", label: "Collections" } };
  }
  const hit = ROUTES.find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return hit ? hit[1] : { label: "Admin" };
}

export function AdminTopBar({ logoSrc, storeName }: { logoSrc: string; storeName: string }) {
  const entry = entryFor(usePathname() ?? "/admin");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white px-4">
      <Link href="/" aria-label={`${storeName} storefront`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt={storeName}
          className="h-9 w-auto max-w-[11rem] object-contain"
        />
      </Link>

      <span aria-hidden className="h-5 w-px bg-border" />

      <div className="min-w-0 flex-1 truncate text-[13px]">
        {entry.back ? (
          <>
            <Link
              href={entry.back.href}
              className="text-ink-soft hover:text-ink hover:underline"
            >
              ← {entry.back.label}
            </Link>
            <span aria-hidden className="px-1.5 text-ink-soft/60">
              /
            </span>
            <span className="font-semibold text-ink">{entry.label}</span>
          </>
        ) : (
          <span className="font-semibold text-ink">{entry.label}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/"
          className="hidden rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-sand sm:block"
        >
          View store ↗
        </Link>
        {entry.action && (
          <Link
            href={entry.action.href}
            className="rounded-lg bg-[#303030] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1a1a1a]"
          >
            {entry.action.label}
          </Link>
        )}
      </div>
    </header>
  );
}
