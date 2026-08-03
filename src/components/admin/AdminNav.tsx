"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Grouped admin navigation with an active state. Grouping keeps the growing
 * list scannable: what you sell, what you've sold, how the site looks.
 */
export const NAV_GROUPS = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "▦" }],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: "🧵" },
      { href: "/admin/collections", label: "Collections", icon: "🗂" },
      { href: "/admin/inventory", label: "Inventory", icon: "📦" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "🧾" },
      { href: "/admin/discounts", label: "Discounts", icon: "🏷" },
      { href: "/admin/traffic", label: "Traffic", icon: "📈" },
    ],
  },
  {
    title: "Storefront",
    items: [
      { href: "/admin/customize", label: "Customize", icon: "🎨" },
      { href: "/admin/text", label: "Site text", icon: "✍️" },
      { href: "/admin/home", label: "Photos", icon: "🖼" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname() ?? "";

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="mt-4 md:mt-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="mb-4">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70">
            {group.title}
          </p>
          <div className="flex flex-wrap gap-1 md:flex-col">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-sage-deep font-semibold text-white"
                      : "font-medium text-ink-soft hover:bg-sand hover:text-ink"
                  }`}
                >
                  <span aria-hidden className="text-xs opacity-80">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
