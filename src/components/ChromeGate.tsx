"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the storefront chrome (header/footer/cart) on admin routes so /admin
 * can render its own layout. Client-only pathname check — does not opt
 * storefront pages out of static rendering.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
