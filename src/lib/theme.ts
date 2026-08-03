import "server-only";
import { unstable_cache } from "next/cache";
import { isDbConfigured, getPrisma } from "@/lib/db";
import {
  THEME_KEY,
  THEME_TAG,
  defaultTheme,
  mergeTheme,
  type Theme,
} from "@/lib/theme-config";

export * from "@/lib/theme-config";

/**
 * Cached reader for the storefront theme. Falls back to the built-in defaults
 * when there's no DB or nothing saved, so the site always renders.
 */
export const getTheme = unstable_cache(
  async (): Promise<Theme> => {
    if (!isDbConfigured()) return defaultTheme();
    try {
      const row = await getPrisma().setting.findUnique({
        where: { key: THEME_KEY },
      });
      if (!row?.value) return defaultTheme();
      return mergeTheme(JSON.parse(row.value));
    } catch {
      return defaultTheme();
    }
  },
  ["site-theme"],
  { tags: [THEME_TAG], revalidate: 3600 },
);
