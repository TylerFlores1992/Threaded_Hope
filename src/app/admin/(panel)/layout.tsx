import type { Metadata } from "next";
import { store } from "@/data/store";
import { getHomeImages } from "@/lib/home-images";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { logout } from "../actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin shell: a light top bar that says where you are and carries the page's
 * primary action, a sidebar of sections, and content on grey with white cards.
 * `.admin-ui` re-points the design tokens (see globals.css), so the console
 * stays neutral no matter what the storefront palette is set to.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const logoSrc = (await getHomeImages()).home_logo ?? "/logo.png";
  return (
    <div className="admin-ui min-h-screen">
      <AdminTopBar logoSrc={logoSrc} storeName={store.name} />

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
