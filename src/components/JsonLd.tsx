/**
 * Renders a JSON-LD structured-data script. Server-safe; the payload is
 * serialized once. Used for Organization/WebSite (site-wide) and Product /
 * Breadcrumb schema (product pages) to help search engines and rich results.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
