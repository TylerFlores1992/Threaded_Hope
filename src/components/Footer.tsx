import Link from "next/link";
import { store } from "@/data/store";
import { getVisibleCollections } from "@/lib/collections";
import { Newsletter } from "./Newsletter";

const helpLinks = [
  { href: "/faqs", label: "FAQs" },
  { href: "/shipping-returns", label: "Shipping & Returns" },
  { href: "/contact", label: "Contact" },
  { href: "/our-story", label: "Our Story" },
];

export async function Footer({ logoSrc = "/logo.png" }: { logoSrc?: string }) {
  const shopLinks = (await getVisibleCollections()).slice(0, 6);
  return (
    <footer className="mt-16 border-t border-border bg-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Link href="/" aria-label={store.name} className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt={store.name}
              className="h-14 w-auto max-w-[11rem] object-contain"
            />
          </Link>
          <p className="mt-3 text-sm text-ink-soft">{store.contact.location}</p>
          <div className="mt-4 flex gap-3">
            <SocialLink href={store.socials.instagram} label="Instagram">IG</SocialLink>
            <SocialLink href={store.socials.facebook} label="Facebook">FB</SocialLink>
            <SocialLink href={store.socials.pinterest} label="Pinterest">PIN</SocialLink>
          </div>
        </div>

        <nav aria-label="Shop">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Shop</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {shopLinks.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="text-ink-soft hover:text-sage-deep">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shop" className="font-medium text-sage-deep hover:underline">
                View all →
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Help">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Help</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {helpLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-soft hover:text-sage-deep">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Join our community
          </h3>
          <p className="mt-3 text-sm text-ink-soft">{store.newsletterPitch}</p>
          <div className="mt-3">
            <Newsletter variant="footer" />
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center">
          <p className="font-serif italic text-ink">{store.scripture.text}</p>
          <p className="mt-1 text-sm text-ink-soft">— {store.scripture.reference}</p>
          <p className="mt-4 text-xs text-ink-soft">
            © {new Date().getFullYear()} {store.name}. Handmade with love.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-soft ring-1 ring-border transition hover:bg-sage-deep hover:text-white"
    >
      {children}
    </a>
  );
}
