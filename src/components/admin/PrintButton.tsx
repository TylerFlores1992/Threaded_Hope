"use client";

/**
 * Triggers the browser's print dialog for the current page. Hidden when
 * printing (via `print:hidden`) so it never shows up on the packing slip.
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-sage-deep px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 print:hidden"
    >
      {label}
    </button>
  );
}
