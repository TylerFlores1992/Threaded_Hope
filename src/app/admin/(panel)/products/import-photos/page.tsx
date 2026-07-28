import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { ImportPhotosClient } from "@/components/admin/ImportPhotosClient";

export const dynamic = "force-dynamic";
// Give each batch request room to download + upload a few products' photos.
export const maxDuration = 60;

export default function ImportPhotosPage() {
  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-soft">
        ← Products
      </Link>
      <h1 className="mt-2 mb-4 font-serif text-3xl text-ink">
        Import photos from Shopify
      </h1>
      {!isDbConfigured() ? (
        <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
          Connect a database to import photos.
        </p>
      ) : (
        <ImportPhotosClient />
      )}
    </div>
  );
}
