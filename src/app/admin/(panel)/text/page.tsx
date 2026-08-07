import { isDbConfigured } from "@/lib/db";
import { getSiteText } from "@/lib/site-text";
import { SiteTextForm } from "@/components/admin/SiteTextForm";

export const dynamic = "force-dynamic";

export default async function SiteTextPage() {
  if (!isDbConfigured()) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to edit site text.
      </p>
    );
  }

  const current = await getSiteText();

  return (
    <div>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-ink-soft">
        Edit the wording across the storefront — headings, buttons, and blurbs on
        the home page, Our Story, and the shop. Changes appear on the site within
        a moment of saving.
      </p>
      <SiteTextForm current={current} />
    </div>
  );
}
