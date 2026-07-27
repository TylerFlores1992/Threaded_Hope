import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import type { Variant } from "@/data/products";
import { ProductForm } from "@/components/admin/ProductForm";
import { updateProduct } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prisma = getPrisma();
  const row = await prisma.product.findUnique({ where: { id } });
  if (!row) notFound();

  const collections = await getAllCollections();
  const storedCollections = Array.isArray(row.collections)
    ? (row.collections as string[])
    : [];
  const values = {
    name: row.name,
    price: row.priceCents / 100,
    collection: row.collectionSlug,
    collections:
      storedCollections.length > 0
        ? Array.from(new Set([row.collectionSlug, ...storedCollections]))
        : [row.collectionSlug],
    description: row.description,
    variants: (Array.isArray(row.variants) ? row.variants : []) as Variant[],
    inStock: row.inStock,
    featured: row.featured,
    stock: row.stock,
    image: row.image ?? undefined,
  };

  const action = updateProduct.bind(null, id);

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-soft">
        ← Products
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-3xl text-ink">
        Edit “{row.name}”
      </h1>
      <ProductForm
        action={action}
        collections={collections}
        product={values}
        submitLabel="Save changes"
      />
    </div>
  );
}
