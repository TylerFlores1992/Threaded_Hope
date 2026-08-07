import Image from "next/image";
import { placeholderImage } from "@/lib/placeholder";

/**
 * A product's photo, or a generated placeholder when it has none.
 *
 * Real photos go through Next's image optimizer: the originals are camera-sized
 * (3000×4000, ~3 MB), and handing one of those to a small card leaves the
 * browser to downscale ~10×, which visibly softens it. `sizes` tells the
 * optimizer how big the image will actually be drawn, so it serves a copy cut
 * to fit.
 *
 * The placeholder is an inline SVG data URI with nothing to optimize, so it
 * stays a plain <img>.
 *
 * A real photo is laid out with `fill`, so whatever renders one must give it a
 * positioned box of a fixed shape to fill. Callers that only ever show the
 * placeholder (cart, checkout) can size it with classes as before.
 */
export function ProductImage({
  name,
  hue,
  image,
  className = "",
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  name: string;
  hue: number;
  image?: string;
  className?: string;
  priority?: boolean;
  /** How wide the image is drawn at each breakpoint — required for `fill`. */
  sizes?: string;
}) {
  if (!image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={placeholderImage(name, hue)}
        alt={name}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={image}
      alt={name}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      loading={priority ? undefined : "lazy"}
    />
  );
}
