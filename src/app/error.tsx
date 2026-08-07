"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Last-resort boundary for unexpected runtime errors. Without it Next shows a
 * bare white "Application error: a client-side exception has occurred", which
 * on a shop reads as "this site is broken" and loses the sale. `reset()` retries
 * the failed render — often enough on a transient database hiccup.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-serif text-6xl text-taupe">Oh dear</p>
      <h1 className="mt-4 font-serif text-3xl text-ink">
        Something came unstitched
      </h1>
      <p className="mt-3 text-ink-soft">
        Sorry about that — this one is on us, not you. Try again, and if it keeps
        happening we&apos;d love to hear from you.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full bg-sand px-6 py-3 text-sm font-semibold text-ink ring-1 ring-border hover:bg-sand-deep"
        >
          Back home
        </Link>
      </div>
      <p className="mt-6 text-xs text-ink-soft">
        <Link href="/contact" className="underline hover:text-sage-deep">
          Contact us
        </Link>
        {error.digest ? ` · reference ${error.digest}` : ""}
      </p>
    </div>
  );
}
