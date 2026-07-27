import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { store } from "@/data/store";
import { SITE_URL, SITE_KEYWORDS } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { getHomeImages } from "@/lib/home-images";
import { getVisibleCollections } from "@/lib/collections";
import { CartProvider } from "@/lib/cart-context";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { ChromeGate } from "@/components/ChromeGate";
import { TrafficTracker } from "@/components/TrafficTracker";

// Friendly humanist serif for headings, clean sans for body.
const heading = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});
const body = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const DEFAULT_DESCRIPTION =
  "Handmade bags, zipper pouches, tote bags, keychains, and faith-based gifts — " +
  "each piece sewn in small batches with care. Shop unique, one-of-a-kind " +
  "handmade fabric accessories and Christian handmade gifts from Threaded Hope.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${store.name} — Handmade Bags, Pouches & Faith-Based Gifts`,
    template: `%s · ${store.name}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: store.name,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${store.name} — Handmade Bags, Pouches & Faith-Based Gifts`,
    description: DEFAULT_DESCRIPTION,
    siteName: store.name,
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${store.name} — Handmade Bags, Pouches & Faith-Based Gifts`,
    description: DEFAULT_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const homeImages = await getHomeImages();
  const logoSrc = homeImages.home_logo ?? "/logo.png";
  const navCollections = await getVisibleCollections();

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    email: store.contact.email,
    slogan: store.tagline,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/logo.png`,
    sameAs: [store.socials.instagram].filter(Boolean),
  };
  const siteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.name,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <JsonLd data={orgSchema} />
        <JsonLd data={siteSchema} />
        <CartProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <ChromeGate>
            <Header logoSrc={logoSrc} collections={navCollections} />
          </ChromeGate>
          <main id="main" className="flex-1">
            {children}
          </main>
          <ChromeGate>
            <Footer logoSrc={logoSrc} />
            <CartDrawer />
          </ChromeGate>
          <TrafficTracker />
        </CartProvider>
      </body>
    </html>
  );
}
