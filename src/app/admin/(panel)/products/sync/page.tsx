import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { SyncShopifyClient } from "@/components/admin/SyncShopifyClient";
import { isShopifyApiConfigured } from "@/lib/shopify";

export const dynamic = "force-dynamic";
// Room for a batch to fetch Shopify and write several products.
export const maxDuration = 60;

export default function SyncShopifyPage() {
  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-soft">
        ← Products
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold text-ink">
        Sync details from Shopify
      </h1>
      {!isDbConfigured() ? (
        <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
          Connect a database to sync product details.
        </p>
      ) : (
        <SyncShopifyClient apiConnected={isShopifyApiConfigured()} />
      )}
    </div>
  );
}
