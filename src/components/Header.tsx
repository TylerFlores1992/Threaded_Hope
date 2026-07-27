"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { store } from "@/data/store";
import type { Collection } from "@/data/collections";
import { useCart } from "@/lib/cart-context";

const primaryNav = [
  { href: "/shop", label: "Shop" },
  { href: "/gifting", label: "Gifting" },
  { href: "/our-story", label: "Our Story" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

export function Header({
  logoSrc = "/logo.png",
  collections = [],
}: {
  logoSrc?: string;
  collections?: Collection[];
}) {
  const { count, openCart } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-cream/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2">
        {/* Left: mobile menu + desktop nav */}
        <div className="flex items-center gap-5 justify-self-start">
          <button
            type="button"
            className="rounded-lg p-2 text-ink hover:bg-sand lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-ink transition hover:text-sage-deep"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Center: logo — in-flow so it sets the header height; natural width
            keeps the wide wordmark undistorted. */}
        <Link href="/" aria-label={store.name} className="justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt={store.name}
            className="h-16 w-auto max-w-[60vw] object-contain md:h-20"
          />
        </Link>

        {/* Right: search + cart */}
        <div className="flex items-center gap-2 justify-self-end">
          <form
            onSubmit={submitSearch}
            role="search"
            className="hidden items-center rounded-full bg-white px-3 py-1.5 ring-1 ring-border md:flex"
          >
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="w-44 bg-transparent px-2 text-sm outline-none placeholder:text-ink-soft focus:w-56 transition-[width]"
            />
          </form>

          <button
            type="button"
            onClick={openCart}
            className="relative rounded-lg p-2 text-ink hover:bg-sand"
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
          >
            <BagIcon />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-border bg-cream lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2" aria-label="Mobile">
            <form onSubmit={submitSearch} role="search" className="my-2 flex items-center rounded-full bg-white px-3 py-2 ring-1 ring-border">
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="w-full bg-transparent px-2 text-sm outline-none placeholder:text-ink-soft"
              />
            </form>
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-border py-3 text-ink"
              >
                {item.label}
              </Link>
            ))}
            <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Collections
            </p>
            <div className="grid grid-cols-2 gap-1 py-2">
              {collections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2 text-sm text-ink hover:bg-sand"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-soft" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
