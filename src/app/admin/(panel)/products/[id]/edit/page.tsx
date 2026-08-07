import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { sizeAxisOf, optionAxesOf } from "@/lib/stock";
import type { Variant } from "@/data/products";
import { ProductForm } from "@/components/admin/ProductForm";
import { StockField } from "@/components/admin/StockField";
import { SizeStockField } from "@/components/admin/SizeStockField";
import { OptionStockField } from "@/components/admin/OptionStockField";
import { updateProduct } from "../../actions";
import { ProductPager } from "@/components/admin/ProductPager";

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

  // Neighbours for the previous/next arrows, in the order the product list
  // opens in. Ids and names only — the catalogue is small enough that this
  // stays cheap on every edit page.
  const ordered = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  const at = ordered.findIndex((p) => p.id === id);
  const pager = (
    <ProductPager
      prev={at > 0 ? ordered[at - 1] : null}
      next={at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null}
      index={at + 1}
      total={ordered.length}
    />
  );
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
    weightOz: row.weightOz,
    status: row.status,
    productType: row.productType,
    vendor: row.vendor,
    image: row.image ?? undefined,
    images: Array.isArray(row.images)
      ? (row.images as string[])
      : row.image
        ? [row.image]
        : [],
  };

  const action = updateProduct.bind(null, id);

  // Live inventory editor (same controls as the Inventory page) so stock can be
  // set from here too. Per-size for sized products, single count otherwise.
  const sizeAxis = sizeAxisOf({ variants: values.variants });
  const sizeStock =
    row.sizeStock && typeof row.sizeStock === "object"
      ? (row.sizeStock as Record<string, number>)
      : {};
  const optionStock =
    row.optionStock && typeof row.optionStock === "object"
      ? (row.optionStock as Record<string, Record<string, number>>)
      : {};
  const optionAxes = optionAxesOf({ variants: values.variants });
  const inventoryEditor = (
    <div className="space-y-2">
      {sizeAxis ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {sizeAxis.options.map((o) => (
            <SizeStockField key={o} id={id} size={o} initial={sizeStock[o] ?? null} />
          ))}
        </div>
      ) : (
        optionAxes.length === 0 && <StockField id={id} initial={row.stock} />
      )}
      {optionAxes.map((v) => (
        <div key={v.name} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-medium text-ink">{v.name}</span>
          {v.options.map((o) => (
            <OptionStockField
              key={o}
              id={id}
              group={v.name}
              option={o}
              initial={optionStock[v.name]?.[o] ?? null}
            />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-soft">
        ← Products
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Edit “{row.name}”</h1>
        {pager}
      </div>
      <ProductForm
        action={action}
        collections={collections}
        product={values}
        submitLabel="Save changes"
        inventoryEditor={inventoryEditor}
      />
    </div>
  );
}
