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
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group relative flex aspect-4/3 items-end overflow-hidden rounded-2xl ring-1 ring-border"
    >
      <img
        src={bg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
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
