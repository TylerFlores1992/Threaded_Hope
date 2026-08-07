import Image from "next/image";
import Link from "next/link";
import type { Collection } from "@/data/collections";
import { placeholderImage } from "@/lib/placeholder";

export function CollectionTile({
  collection,
  image,
}: {
  collection: Collection;
  image?: string;
}) {
  const bg = image ?? placeholderImage(collection.name, collection.hue);
  const cover = "absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105";
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group relative flex aspect-4/3 items-end overflow-hidden rounded-2xl ring-1 ring-border"
    >
      {image ? (
        /* Optimized: the source is a full-size photo and the tile is a few
           hundred pixels wide. The placeholder below is an SVG data URI. */
        <Image
          src={image}
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className={cover}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg} alt="" aria-hidden="true" className={cover} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
      <div className="relative p-4">
        <h3 className="font-serif text-lg font-semibold text-white drop-shadow">
          {collection.name}
        </h3>
        <span className="text-sm text-cream/90">Shop now →</span>
      </div>
    </Link>
  );
}
