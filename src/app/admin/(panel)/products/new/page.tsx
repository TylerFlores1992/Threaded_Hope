import Link from "next/link";
import { collections } from "@/data/collections";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProduct } from "../actions";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-soft">
        ← Products
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-3xl text-ink">New product</h1>
      <ProductForm
        action={createProduct}
        collections={collections}
        submitLabel="Create product"
      />
    </div>
  );
}
