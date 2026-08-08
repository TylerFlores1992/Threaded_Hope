import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { getAllCollections } from "@/lib/collections";
import { getGiftingConfig } from "@/lib/gifting";
import { getSiteText } from "@/lib/site-text";
import { GiftingSettingsEditor } from "@/components/admin/GiftingSettingsEditor";

export const dynamic = "force-dynamic";

/**
 * The Gifting page's settings, under Online Store with the other storefront
 * pages rather than buried under Collections — it's a page you edit, not a
 * property of a collection.
 */
export default async function AdminGiftsPage() {
  if (!isDbConfigured()) {
    return (
      <p className="rounded-lg bg-sand p-4 text-[13px] text-ink-soft">
        Connect a database to edit the gifting page.
      </p>
    );
  }

  const [collections, gifting, text] = await Promise.all([
    getAllCollections(),
    getGiftingConfig(),
    getSiteText(),
  ]);

  return (
    <div className="max-w-3xl">
      <p className="text-[13px] text-ink-soft">
        What appears on your{" "}
        <Link href="/gifting" className="text-sage-deep underline">
          gift guide
        </Link>
        . The headings and wording live under{" "}
        <Link href="/admin/text" className="text-sage-deep underline">
          Site text
        </Link>
        , in the &ldquo;Gifting page&rdquo; group.
      </p>

      <GiftingSettingsEditor
        collections={collections.map((c) => ({ slug: c.slug, name: c.name }))}
        tiles={gifting.tiles}
        guide2={gifting.guide2}
        guide3={gifting.guide3}
        guide2Heading={text.gifting_guide2_heading}
        guide3Heading={text.gifting_guide3_heading}
      />
    </div>
  );
}
