import Link from "next/link";
import type { Product } from "@/data/products";
import { formatPrice } from "@/lib/format";
import { priceRange, hasVariablePricing } from "@/lib/pricing";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white/70 ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-taupe/20"
    >
      <div className="relative aspect-square overflow-hidden">
        <ProductImage
          name={product.name}
          hue={product.hue}
          image={product.image}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {!product.inStock && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-cream">
            Sold out
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs uppercase tracking-wide text-ink-soft">
          {product.collectionName}
        </p>
        <h3 className="font-serif text-lg leading-snug text-ink">
          {product.name}
        </h3>
        <p className="mt-auto pt-2 font-semibold text-sage-deep">
          {hasVariablePricing(product)
            ? `From ${formatPrice(priceRange(product).min)}`
            : formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
