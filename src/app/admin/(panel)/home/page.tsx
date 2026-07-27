import { isDbConfigured } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { HOME_IMAGE_SLOTS } from "@/lib/home-images";
import { HomeImagesForm } from "@/components/admin/HomeImagesForm";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  if (!isDbConfigured()) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to manage site photos.
      </p>
    );
  }

  const entries = await Promise.all(
    HOME_IMAGE_SLOTS.map(
      async (s) => [s.key, (await getSetting(s.key)) || undefined] as const,
    ),
  );
  const current = Object.fromEntries(entries);

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Photos</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Upload the editable non-product photos across the site. Each slot falls
        back to a sensible default when empty — the logo appears in the header,
        footer, and story section; the hero images fill the home collage; the
        story images sit beside the home blurb and atop the Our Story page.
        Changes appear on the site within a moment of saving.
      </p>

      <div className="mt-6">
        <HomeImagesForm current={current} />
      </div>
    </div>
  );
}
