"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { setSetting } from "@/lib/settings";
import { getPrisma } from "@/lib/db";
import {
  THEME_KEY,
  THEME_TAG,
  mergeTheme,
  defaultTheme,
  type Theme,
} from "@/lib/theme-config";

/** Persist the theme (colors, fonts, layout, section order/visibility). */
export async function saveTheme(theme: Theme): Promise<void> {
  getPrisma(); // clear error if no DB
  await setSetting(THEME_KEY, JSON.stringify(mergeTheme(theme)));
  revalidateTag(THEME_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/customize");
}

/** Restore every appearance setting to the built-in defaults. */
export async function resetTheme(): Promise<void> {
  getPrisma();
  await setSetting(THEME_KEY, JSON.stringify(defaultTheme()));
  revalidateTag(THEME_TAG, "max");
  revalidatePath("/", "layout");
  revalidatePath("/admin/customize");
}
