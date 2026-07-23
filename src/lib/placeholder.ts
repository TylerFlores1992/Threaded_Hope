/**
 * Generates a good-looking, deterministic SVG placeholder image as a data URI.
 * No network calls — swap real images in later by giving products an `image`
 * URL and using it in <ProductImage /> instead of this generator.
 */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export function placeholderImage(name: string, hue = 145): string {
  const light = `hsl(${hue}, 32%, 90%)`;
  const mid = `hsl(${hue}, 30%, 78%)`;
  const deep = `hsl(${hue}, 28%, 55%)`;
  const label = initials(name);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${escapeXml(
    name,
  )}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${mid}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <g stroke="${deep}" stroke-width="2" opacity="0.35" fill="none">
    <path d="M0 150 Q 300 90 600 150"/>
    <path d="M0 300 Q 300 240 600 300"/>
    <path d="M0 450 Q 300 390 600 450"/>
  </g>
  <circle cx="300" cy="300" r="120" fill="white" opacity="0.55"/>
  <text x="300" y="300" font-family="Georgia, serif" font-size="96" font-weight="600"
    fill="${deep}" text-anchor="middle" dominant-baseline="central">${escapeXml(
      label,
    )}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
