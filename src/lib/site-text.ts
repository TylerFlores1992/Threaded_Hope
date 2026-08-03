import "server-only";
import { unstable_cache } from "next/cache";
import { isDbConfigured, getPrisma } from "@/lib/db";
import {
  SITE_TEXT_FIELDS,
  SITE_TEXT_TAG,
  textSettingKey,
  defaultSiteText,
  type SiteText,
} from "@/lib/site-text-fields";

export {
  SITE_TEXT_FIELDS,
  SITE_TEXT_GROUPS,
  SITE_TEXT_TAG,
  textSettingKey,
  type SiteText,
} from "@/lib/site-text-fields";

/**
 * Cached reader for admin-editable site copy. Overrides live in the `Setting`
 * table (`text_<key>`); anything unset falls back to the field's default, so the
 * site reads normally with no DB and nothing changes until it's edited.
 */
export const getSiteText = unstable_cache(
  async (): Promise<SiteText> => {
    const text = defaultSiteText();
    if (!isDbConfigured()) return text;
    try {
      const keys = SITE_TEXT_FIELDS.map((f) => textSettingKey(f.key));
      const rows = await getPrisma().setting.findMany({
        where: { key: { in: keys } },
      });
      for (const row of rows) {
        const key = row.key.replace(/^text_/, "");
        if (row.value?.trim()) text[key] = row.value;
      }
    } catch {
      /* fall back to defaults */
    }
    return text;
  },
  ["site-text"],
  { tags: [SITE_TEXT_TAG], revalidate: 3600 },
);
