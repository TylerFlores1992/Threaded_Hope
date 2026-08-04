"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Global search in the top bar, like Shopify's. Submits to /admin/search, which
 * looks across products, orders, customers and collections. Ctrl/⌘-K focuses it.
 */
export function AdminSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/admin/search?q=${encodeURIComponent(q)}`);
      }}
      className="flex w-full max-w-xl items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 ring-1 ring-white/15 focus-within:bg-white/15"
    >
      <span aria-hidden className="text-sm text-white/60">
        ⌕
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="search"
        placeholder="Search"
        aria-label="Search the admin"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/50 focus:outline-none"
      />
      <kbd className="hidden rounded border border-white/20 px-1.5 text-[10px] font-medium text-white/50 sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}
