"use client";

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
  const [active, setActive] = useState(0);
  const current = pics[Math.min(active, pics.length - 1)];

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-border">
        {/* Natural height (h-auto) shows the full photo with no crop and no
            letterbox bars — the frame adapts to the image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={name}
          className="h-auto w-full"
          loading="eager"
          decoding="async"
        />
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${name} thumbnail ${i + 1}`}
                className="aspect-[4/5] w-full bg-white object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
