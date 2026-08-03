import { isDbConfigured } from "@/lib/db";
import { getTheme } from "@/lib/theme";
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

  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">Customize</h1>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-ink-soft">
        Change how the storefront looks — colors, fonts, layout, and which home
        page sections show and in what order. Edits preview live; nothing is
        public until you press Save.
      </p>
      <ThemeEditor initial={theme} />
    </div>
  );
}
