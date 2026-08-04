import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { isShopifyApiConfigured } from "@/lib/shopify";
import { ImportShopifyOrders } from "@/components/admin/ImportShopifyOrders";

export const dynamic = "force-dynamic";
// Room for a page of orders to be fetched and written.
export const maxDuration = 60;

export default function ImportOrdersPage() {
  return (
    <div>
      <Link href="/admin/orders" className="text-[13px] text-ink-soft">
        ← Orders
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold text-ink">
        Import from Shopify
      </h1>

      {!isDbConfigured() ? (
        <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
          Connect a database to import orders.
        </p>
      ) : !isShopifyApiConfigured() ? (
        <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
          Add the Shopify Admin API credentials in Vercel
          (SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET) to
          import your history.
        </p>
      ) : (
        <ImportShopifyOrders />
      )}
    </div>
  );
}
