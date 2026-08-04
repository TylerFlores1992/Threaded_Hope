import Link from "next/link";
import { getAllCollections } from "@/lib/collections";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const collections = await getAllCollections();
  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-soft">
        ← Products
      </Link>
      <h1 className="mt-2 mb-6 text-xl font-semibold text-ink">New product</h1>
      <ProductForm
        action={createProduct}
        collections={collections}
        submitLabel="Create product"
      />
    </div>
  );
}
