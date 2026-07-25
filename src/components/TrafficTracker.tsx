"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires a lightweight page-view beacon on each storefront navigation.
 * Skips admin routes. Best-effort — failures are ignored.
 */
export function TrafficTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer || null,
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body, keepalive: true });
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
