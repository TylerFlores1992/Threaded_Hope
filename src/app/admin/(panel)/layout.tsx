import Link from "next/link";
import type { Metadata } from "next";
import { store } from "@/data/store";
import { getHomeImages } from "@/lib/home-images";
import { logout } from "../actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/home", label: "Photos" },
  { href: "/admin/text", label: "Site text" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/collections", label: "Collections" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/discounts", label: "Discounts" },
  { href: "/admin/traffic", label: "Traffic" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logoSrc = (await getHomeImages()).home_logo ?? "/logo.png";
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <div className="flex items-center justify-between md:block">
          <div>
            {/* Logo returns to the storefront. */}
            <Link href="/" aria-label={`${store.name} — view store`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt={store.name}
                className="h-12 w-auto max-w-[11rem] object-contain"
              />
            </Link>
            <Link
              href="/admin"
              className="mt-1 block text-xs text-ink-soft hover:text-ink"
            >
              Store admin
            </Link>
          </div>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2 md:mt-6 md:flex-col">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-border pt-4">
          <Link
            href="/"
            className="block px-3 py-1 text-xs text-ink-soft hover:text-ink"
          >
            ← View store
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 px-3 py-1 text-xs text-ink-soft hover:text-red-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
