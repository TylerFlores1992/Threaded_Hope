import Link from "next/link";

export type PagerNeighbour = { id: string; name: string } | null;

/**
 * Previous/next links on the product editor, so a run of edits doesn't mean a
 * trip back to the list each time.
 *
 * Deliberately server-rendered from a fixed order (newest first, the order the
 * product list opens in) rather than following whatever sort or filter the list
 * happened to be showing. Reading that from the browser made the arrows render
 * one way on the server and another on the client, which React reports as a
 * hydration mismatch — a predictable order is worth more here than a
 * personalised one.
 */
export function ProductPager({
  prev,
  next,
  index,
  total,
}: {
  prev: PagerNeighbour;
  next: PagerNeighbour;
  index: number;
  total: number;
}) {
  if (!prev && !next) return null;

  const cls =
    "rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-sand";

  return (
    <div className="flex items-center gap-2">
      {total > 0 && (
        <span className="text-[12px] text-ink-soft">
          {index} of {total}
        </span>
      )}
      {prev ? (
        <Link
          href={`/admin/products/${prev.id}/edit`}
          title={`Previous: ${prev.name}`}
          aria-label={`Previous product: ${prev.name}`}
          className={cls}
        >
          ←
        </Link>
      ) : (
        <span className={`${cls} cursor-default opacity-40`} aria-hidden>
          ←
        </span>
      )}
      {next ? (
        <Link
          href={`/admin/products/${next.id}/edit`}
          title={`Next: ${next.name}`}
          aria-label={`Next product: ${next.name}`}
          className={cls}
        >
          →
        </Link>
      ) : (
        <span className={`${cls} cursor-default opacity-40`} aria-hidden>
          →
        </span>
      )}
    </div>
  );
}
