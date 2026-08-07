import { isDbConfigured } from "@/lib/db";
import { getTheme } from "@/lib/theme";
import { getSiteText } from "@/lib/site-text";
import { getAllCollections } from "@/lib/collections";
import { getThemeVersions } from "./actions";
import { ThemeEditor } from "@/components/admin/ThemeEditor";

export const dynamic = "force-dynamic";

export default async function CustomizePage() {
  if (!isDbConfigured()) {
    return (
      <p className="rounded-lg bg-sand p-4 text-sm text-ink-soft">
        Connect a database to customize the storefront.
      </p>
    );
  }

  const theme = await getTheme();
  const text = await getSiteText();
  const versions = await getThemeVersions();
  // Fills the "Collection" dropdown on Featured products sections.
  const collections = (await getAllCollections()).map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  return (
    <div>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-soft">
        Change how the storefront looks — colors, fonts, layout, and the home
        page itself. Add sections, fill in their text and photos, drag them into
        order. Nothing is public until you press Save.
      </p>
      <ThemeEditor
        initial={theme}
        initialText={text}
        versions={versions}
        collections={collections}
      />
    </div>
  );
}
