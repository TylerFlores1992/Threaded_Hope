import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { store } from "@/data/store";
import { CartProvider } from "@/lib/cart-context";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { ChromeGate } from "@/components/ChromeGate";

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://threaded-hope.com",
  ),
  title: {
    default: `${store.name} — Handmade Fabric Accessories`,
    template: `%s · ${store.name}`,
  },
  description: store.heroSubtitle,
  openGraph: {
    title: `${store.name} — Handmade Fabric Accessories`,
    description: store.heroSubtitle,
    siteName: store.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <CartProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <ChromeGate>
            <Header />
          </ChromeGate>
          <main id="main" className="flex-1">
            {children}
          </main>
          <ChromeGate>
            <Footer />
            <CartDrawer />
          </ChromeGate>
        </CartProvider>
      </body>
    </html>
  );
}
