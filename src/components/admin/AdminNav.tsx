"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Admin navigation, following Shopify's information architecture: a flat list
 * of top-level destinations, with sub-items revealed under the active section.
 */
type NavItem = {
  href: string;
  label: string;
  icon: string;
  children?: { href: string; label: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Home", icon: "⌂" },
  { href: "/admin/orders", label: "Orders", icon: "▤" },
  {
    href: "/admin/products",
    label: "Products",
    icon: "◫",
    children: [
      { href: "/admin/collections", label: "Collections" },
      { href: "/admin/inventory", label: "Inventory" },
    ],
  },
  { href: "/admin/customers", label: "Customers", icon: "☺" },
  { href: "/admin/discounts", label: "Discounts", icon: "％" },
  { href: "/admin/stripe", label: "Stripe", icon: "◈" },
  { href: "/admin/traffic", label: "Analytics", icon: "◪" },
];

export const CHANNEL_ITEMS: NavItem[] = [
  {
    href: "/admin/customize",
    label: "Online Store",
    icon: "▣",
    children: [
      { href: "/admin/customize", label: "Home page" },
      { href: "/admin/gifts", label: "Gifts" },
      { href: "/admin/text", label: "Site text" },
      { href: "/admin/home", label: "Photos" },
    ],
  },
];

const itemClass = (active: boolean) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition ${
    active
      ? "bg-white font-semibold text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.06)]"
      : "font-medium text-ink-soft hover:bg-black/5 hover:text-ink"
  }`;

export function AdminNav() {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  /** A section is open when it, or any of its sub-items, is the current page. */
  const sectionOpen = (item: NavItem) =>
    isActive(item.href) || (item.children ?? []).some((c) => isActive(c.href));

  const renderItem = (item: NavItem) => {
    const open = sectionOpen(item);
    return (
      <div key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={itemClass(isActive(item.href))}
        >
          <span aria-hidden className="w-4 text-center text-[13px] opacity-70">
            {item.icon}
          </span>
          {item.label}
        </Link>
        {open && item.children && (
          <div className="mt-0.5 space-y-0.5">
            {item.children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                aria-current={isActive(c.href) ? "page" : undefined}
                className={`block rounded-lg py-1.5 pl-10 pr-3 text-[13px] transition ${
                  isActive(c.href)
                    ? "bg-white font-semibold text-ink shadow-[0_1px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.06)]"
                    : "text-ink-soft hover:bg-black/5 hover:text-ink"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="space-y-0.5">
      {NAV_ITEMS.map(renderItem)}
      <p className="px-3 pb-1 pt-4 text-[11px] font-semibold text-ink-soft/70">
        Sales channels
      </p>
      {CHANNEL_ITEMS.map(renderItem)}
    </nav>
  );
}
