import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-serif text-6xl text-taupe">404</p>
      <h1 className="mt-4 font-serif text-3xl text-ink">This thread got lost</h1>
      <p className="mt-3 text-ink-soft">
        We couldn&apos;t find the page you were looking for.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-sage-deep px-6 py-3 text-sm font-semibold text-white hover:bg-sage"
      >
        Back home
      </Link>
    </div>
  );
}
