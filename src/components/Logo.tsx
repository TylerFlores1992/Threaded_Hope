/**
 * A subtle needle-and-thread motif with a small cross woven in —
 * a gentle nod to the handmade, faith-inspired brand.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* needle */}
      <line x1="10" y1="38" x2="30" y2="18" />
      <circle cx="9" cy="39" r="2.2" fill="currentColor" stroke="none" />
      {/* thread loop */}
      <path d="M30 18 C 40 14, 40 26, 33 27 C 26 28, 30 20, 36 22" />
      {/* small cross stitch */}
      <line x1="20" y1="10" x2="20" y2="20" opacity="0.7" />
      <line x1="16" y1="14" x2="24" y2="14" opacity="0.7" />
    </svg>
  );
}
