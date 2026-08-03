"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSetting, setSetting } from "@/lib/settings";
import { getPrisma } from "@/lib/db";
import { SITE_TEXT_TAG, textSettingKey } from "@/lib/site-text-fields";
import {
  THEME_KEY,
  THEME_TAG,
  mergeTheme,
  defaultTheme,
  type Theme,
} from "@/lib/theme-config";

const HISTORY_KEY = "theme_history";
const MAX_VERSIONS = 10;

export type ThemeVersion = { id: string; savedAt: string; theme: Theme };

export async function getThemeVersions(): Promise<ThemeVersion[]> {
  const raw = await getSetting(HISTORY_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ThemeVersion[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Snapshot the *current* theme before overwriting it, newest first. */
async function pushVersion(label: string) {
  const current = await getSetting(THEME_KEY);
  if (!current) return;
  try {
    const versions = await getThemeVersions();
    versions.unshift({
      id: label,
      savedAt: label,
      theme: mergeTheme(JSON.parse(current)),
    });
    await setSetting(
      HISTORY_KEY,
      JSON.stringify(versions.slice(0, MAX_VERSIONS)),
    );
  } catch {
    /* history is best-effort */
  }
}

/**
 * Persist the theme, and any site-text edited from within a section panel.
 * `stamp` is the client's timestamp (server render can't call Date.now()).
 */
export async function saveTheme(
  theme: Theme,
  text?: Record<string, string>,
  stamp?: string,
): Promise<void> {
  getPrisma(); // clear error if no DB
  await pushVersion(stamp ?? "previous");
  await setSetting(THEME_KEY, JSON.stringify(mergeTheme(theme)));

  if (text) {
    for (const [key, value] of Object.entries(text)) {
      await setSetting(textSettingKey(key), value);
    }
    revalidateTag(SITE_TEXT_TAG, "max");
  }

  revalidateTag(THEME_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/customize");
}

/** Restore every appearance setting to the built-in defaults. */
export async function resetTheme(stamp?: string): Promise<void> {
  getPrisma();
  await pushVersion(stamp ?? "previous");
  await setSetting(THEME_KEY, JSON.stringify(defaultTheme()));
  revalidateTag(THEME_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/customize");
}

/** Roll back to a saved version. */
export async function restoreVersion(id: string, stamp?: string): Promise<void> {
  getPrisma();
  const versions = await getThemeVersions();
  const found = versions.find((v) => v.id === id);
  if (!found) return;
  await pushVersion(stamp ?? "previous");
  await setSetting(THEME_KEY, JSON.stringify(mergeTheme(found.theme)));
  revalidateTag(THEME_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/customize");
}
