"use client";

import Image from "next/image";
import { useState } from "react";
import { placeholderImage } from "@/lib/placeholder";

/**
 * Product image gallery: a large main image with a thumbnail strip when there's
 * more than one photo. Falls back to the generated placeholder when there are
 * none. Client component so thumbnails can swap the main image.
 */
export function ProductGallery({
  name,
  hue,
  images,
}: {
  name: string;
  hue: number;
  images: string[];
}) {
  const pics = images.length > 0 ? images : [placeholderImage(name, hue)];
  const isPlaceholder = images.length === 0;
  const [active, setActive] = useState(0);
  const current = pics[Math.min(active, pics.length - 1)];

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
        {/* Natural height (h-auto) shows the full photo with no crop and no
            letterbox bars — the frame adapts to the image. The width/height
            pair only reserves space while it loads; once the photo arrives its
            own proportions take over, so a landscape shot isn't squeezed. */}
        {isPlaceholder ? (
          /* Inline SVG data URI — nothing for the optimizer to do. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={current} alt={name} className="h-auto w-full" decoding="async" />
        ) : (
          <Image
            src={current}
            alt={name}
            width={1200}
            height={1500}
            sizes="(min-width: 768px) 55vw, 100vw"
            className="h-auto w-full"
            priority
          />
        )}
      </div>

      {pics.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {pics.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
              aria-current={i === active}
              className={`overflow-hidden rounded-lg ring-1 transition ${
                i === active
                  ? "ring-2 ring-sage-deep"
                  : "ring-border hover:ring-sage-deep/50"
              }`}
            >
              <span className="relative block aspect-[4/5] w-full bg-white">
                {isPlaceholder ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`${name} thumbnail ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Image
                    src={src}
                    alt={`${name} thumbnail ${i + 1}`}
                    fill
                    sizes="(min-width: 768px) 11vw, 20vw"
                    className="object-cover"
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
