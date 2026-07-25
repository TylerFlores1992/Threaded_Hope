import { placeholderImage } from "@/lib/placeholder";

/**
 * Renders a product's image. Uses a generated SVG placeholder for now.
 * To use real images later, add an `image` field to products and render it here.
 */
export function ProductImage({
  name,
  hue,
  image,
  className = "",
  priority = false,
}: {
  name: string;
  hue: number;
  image?: string;
  className?: string;
  priority?: boolean;
}) {
  const src = image || placeholderImage(name, hue);
  return (
    // Placeholder is an inline SVG data URI, so a plain <img> is appropriate here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
