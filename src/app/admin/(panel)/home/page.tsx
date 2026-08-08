import { isDbConfigured } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { HOME_IMAGE_SLOTS } from "@/lib/home-images";
import { collectionHeroKey, type ImageSlot } from "@/lib/home-image-slots";
import { getAllCollections } from "@/lib/collections";
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

  // Site-wide slots + one banner slot per collection.
  const collections = await getAllCollections();
  const collectionSlots: ImageSlot[] = collections.map((c) => ({
    key: collectionHeroKey(c.slug),
    label: c.name,
    help: `Banner behind the “${c.name}” collection title.`,
  }));

  const entries = await Promise.all(
    [...HOME_IMAGE_SLOTS, ...collectionSlots].map(
      async (s) => [s.key, (await getSetting(s.key)) || undefined] as const,
    ),
  );
  const current = Object.fromEntries(entries);

  return (
    <div>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Every photo on the site that isn&apos;t a product photo, grouped by where
        it appears. Each falls back to a sensible default when empty, and changes
        show on the site within a moment of saving.
      </p>

      <div className="mt-6">
        <HomeImagesForm current={current} collectionSlots={collectionSlots} />
      </div>
    </div>
  );
}
