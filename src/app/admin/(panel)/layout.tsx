import Link from "next/link";
import type { Metadata } from "next";
import { store } from "@/data/store";
import { getHomeImages } from "@/lib/home-images";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { logout } from "../actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin shell, laid out like Shopify's: a dark global bar with search across
 * the top, a light grey sidebar, and content on grey with white cards.
 * `.admin-ui` re-points the design tokens (see globals.css), so the console
 * stays neutral no matter what the storefront palette is set to.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logoSrc = (await getHomeImages()).home_logo ?? "/logo.png";
  const initials = store.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="admin-ui min-h-screen">
      {/* Global bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#1a1a1a] px-3">
        <Link
          href="/admin"
          aria-label={`${store.name} admin`}
          className="shrink-0 rounded bg-white/95 px-2 py-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            className="h-7 w-auto max-w-[9rem] object-contain"
          />
        </Link>

        <div className="flex flex-1 justify-center">
          <AdminSearch />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="hidden rounded-lg px-2.5 py-1.5 text-[13px] text-white/70 hover:bg-white/10 hover:text-white sm:block"
          >
            View store
          </Link>
          <span className="flex items-center gap-2 rounded-lg bg-white/10 py-1 pl-1 pr-2.5">
            <span className="grid h-6 w-6 place-items-center rounded bg-[#36fba1] text-[10px] font-bold text-[#1a1a1a]">
              {initials}
            </span>
            <span className="hidden text-[13px] font-medium text-white sm:block">
              {store.name}
            </span>
          </span>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 px-3 py-3 md:block">
          <AdminNav />
          <div className="mt-6 border-t border-border pt-3">
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-[13px] text-ink-soft hover:bg-black/5 hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* On mobile the nav sits above the content rather than in a drawer. */}
        <div className="w-full min-w-0">
          <div className="border-b border-border px-3 py-2 md:hidden">
            <AdminNav />
          </div>
          <main className="mx-auto max-w-[1360px] px-4 py-5 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
