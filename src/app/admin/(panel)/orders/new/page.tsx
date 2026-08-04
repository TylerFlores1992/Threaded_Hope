import Link from "next/link";
import { prisma, isDbConfigured } from "@/lib/db";
import { sizeAxisOf } from "@/lib/stock";
import type { Variant } from "@/data/products";
import {
  ManualOrderForm,
  type PickerProduct,
} from "@/components/admin/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!isDbConfigured() || !prisma) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to record orders.
      </p>
    );
  }

  const rows = await prisma.product.findMany({ orderBy: { name: "asc" } });
  const products: PickerProduct[] = rows.map((p) => {
    const variants = (Array.isArray(p.variants) ? p.variants : []) as Variant[];
    return {
      slug: p.slug,
      name: p.name,
      price: p.priceCents / 100,
      sizes: sizeAxisOf({ variants })?.options ?? [],
    };
  });

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-ink-soft">
        ← Orders
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">Record a sale</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-soft">
        For sales made outside the website — in person, at a fair, or to a
        friend. Payment is assumed already collected; this records the sale so it
        counts toward your totals and (optionally) reduces inventory.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ManualOrderForm products={products} />
    </div>
  );
}
